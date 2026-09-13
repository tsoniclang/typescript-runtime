import assert from "node:assert/strict";
import { test } from "node:test";
import { boundLocation, location, nestedPropertyLocation, propertyLocation, sameLocation, viewLocation } from "../location.js";
import { bindMemoryRecord, boundFieldIdentity, requireBoundField } from "./bindings.js";
import { arrayElementLocation, offsetRawPointer, reinterpretRawPointer, sameRawPointer, toRawPointer } from "../raw-pointer.js";
import { uint32Layout } from "./scalars.js";
import { locationMemory } from "./storage.js";
import { memoryAddress, retainMemoryAddress } from "./address.js";
import { recordField, recordLayout } from "./record.js";
import type { MemoryLayout } from "./layout.js";

interface Pair { first: number; second: number }

function bindPair(first: import("../location.js").Location<number>, second: import("../location.js").Location<number>): Pair {
  return bindMemoryRecord({ first, second }, pointers => ({
    locations: [pointers.first, pointers.second],
    value: {
      get first() { return pointers.first.value; }, set first(value: number) { pointers.first.value = value; },
      get second() { return pointers.second.value; }, set second(value: number) { pointers.second.value = value; },
    },
    identity: key => key === "first" ? boundFieldIdentity(pointers.first) :
      key === "second" ? boundFieldIdentity(pointers.second) : undefined,
  }));
}

function pairLayout(): MemoryLayout<Pair> {
  const word = uint32Layout("little", 4, 4);
  return recordLayout<Pair>("little", 8, 4, 8, [recordField<Pair, "first">("first", 0, word), recordField<Pair, "second">("second", 4, word)], access => ({
    get first() { return access.read(0, word); }, set first(value: number) { access.write(0, word, value); },
    get second() { return access.read(4, word); }, set second(value: number) { access.write(4, word, value); },
  }));
}

test("explicit record fields preserve captured locations without construction reads", () => {
  let reads = 0;
  let value = 3;
  let selected = boundLocation({}, () => { reads++; return value; }, next => { value = next; });
  const original = selected;
  const record = bindMemoryRecord({ count: { Count: selected } }, fields => {
    const count = requireBoundField(fields.count.Count);
    return {
      locations: [count],
      value: { get Count() { return count.value; }, set Count(value: number) { count.value = value; } },
      identity: key => key === "Count" ? boundFieldIdentity(count) : undefined,
    };
  });
  assert.equal(reads, 0);
  selected = location(19);
  record.Count = 7;
  assert.equal(value, 7);
  assert.equal(selected.value, 19);
  assert.equal(sameLocation(propertyLocation(record, "Count"), original), true);
  const parent = location(record);
  const nested = nestedPropertyLocation(parent, "Count");
  assert.equal(sameLocation(nested, original), true);
  parent.value = { Count: 100 };
  nested.value = 8;
  assert.equal(value, 8);
  assert.equal(parent.value.Count, 100);
  const ordinary = { get Count() { return original.value; }, set Count(value: number) { original.value = value; } };
  assert.equal(sameLocation(propertyLocation(ordinary, "Count"), original), false);
  assert.equal(reads, 0);
});

test("one-past pointer views do not license element I/O or allocate a substitute", () => {
  const values = [11];
  const word = uint32Layout("little", 4, 4);
  const first = arrayElementLocation(values, 0, word);
  const endRaw = offsetRawPointer(toRawPointer(first, word), 4);
  const end = reinterpretRawPointer(endRaw, word);
  assert.ok(end);
  const view = viewLocation(end, () => 0, () => {});
  assert.equal(view.value, 0);
  view.value = 0;
  assert.equal(sameLocation(view, end), true);
  assert.equal(sameRawPointer(toRawPointer(view, word), endRaw), true);
  assert.throws(() => end.value, /exceeds/);
  assert.throws(() => { end.value = 2; }, /exceeds/);
  assert.deepEqual(values, [11]);
  assert.throws(() => arrayElementLocation(values, 2, word), /outside/);
});

test("raw provenance belongs to the canonical location, not one pointer wrapper", () => {
  const object = { value: 17 };
  const first = propertyLocation(object, "value");
  const second = propertyLocation(object, "value");
  const word = uint32Layout("little", 4, 4);
  const raw = toRawPointer(first, word);
  assert.equal(sameRawPointer(toRawPointer(second, word), raw), true);
  const restored = reinterpretRawPointer(raw, word);
  assert.ok(restored);
  restored.value = 23;
  assert.equal(second.value, 23);
  const other = location(7);
  const conflicting = memoryAddress(locationMemory(other, word), 0);
  assert.throws(() => retainMemoryAddress(second, conflicting), /cannot change/);
  assert.equal(sameRawPointer(toRawPointer(second, word), raw), true);
});

test("a bound record publishes one containing allocation to old and new field aliases", () => {
  const first = location(11);
  const second = location(22);
  const record = bindPair(first, second);
  const oldAlias = propertyLocation(record, "second");
  const raw = toRawPointer(location(record), pairLayout());
  const word = uint32Layout("little", 4, 4);
  const fieldRaw = offsetRawPointer(raw, 4);
  assert.equal(sameRawPointer(toRawPointer(second, word), fieldRaw), true);
  assert.equal(sameRawPointer(toRawPointer(oldAlias, word), fieldRaw), true);
  const restored = reinterpretRawPointer(raw, pairLayout());
  assert.ok(restored);
  restored.value = { first: 33, second: 44 };
  assert.equal(first.value, 33);
  assert.equal(oldAlias.value, 44);
  assert.equal(sameLocation(propertyLocation(restored.value, "second"), oldAlias), true);
});

test("contradictory bound allocations reject without publishing a partial association", () => {
  const first = location(11);
  const second = location(22);
  const word = uint32Layout("little", 4, 4);
  const previous = toRawPointer(second, word);
  const record = bindPair(first, second);
  assert.throws(() => toRawPointer(location(record), pairLayout()), /conflicting retained/);
  assert.equal(sameRawPointer(toRawPointer(second, word), previous), true);
  const firstRaw = toRawPointer(first, word);
  assert.throws(() => offsetRawPointer(firstRaw, 8), /outside/);
  assert.deepEqual([first.value, second.value], [11, 22]);
});

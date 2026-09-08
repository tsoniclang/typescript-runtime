import assert from "node:assert/strict";
import test from "node:test";
import { hashLocation, location, propertyLocation, sameLocation } from "../location.js";
import { hashRawPointer, offsetRawPointer, reinterpretRawPointer, sameRawPointer, toRawPointer } from "../raw-pointer.js";
import { recordField, recordLayout } from "./record.js";
import { uint8Layout, uint32Layout } from "./scalars.js";
import type { ByteOrder, MemoryLayout } from "./layout.js";

interface Pair { First: number; Second: number }

function pairLayout(order: ByteOrder): MemoryLayout<Pair> {
  const word = uint32Layout(order, 4, 4);
  return recordLayout<Pair>(order, 12, 4, 12, [
    recordField<Pair, "First">("First", 0, word),
    recordField<Pair, "Second">("Second", 8, word),
  ], access => ({
    get First() { return access.read(0, word); },
    set First(value: number) { access.write(0, word, value); },
    get Second() { return access.read(8, word); },
    set Second(value: number) { access.write(8, word, value); },
  }));
}

for (const order of ["little", "big"] as const) {
  test(`record byte writes preserve existing field aliases: ${order}`, () => {
    const original = { First: 1, Second: 2 };
    const root = location(original);
    const saved = propertyLocation(original, "Second");
    const layout = pairLayout(order);
    const raw = toRawPointer(root, layout);
    const second = reinterpretRawPointer(offsetRawPointer(raw, 8), uint32Layout(order, 4, 4));
    assert.ok(second);
    second.value = 9;
    assert.equal(root.value, original);
    assert.equal(saved.value, 9);
    const view = reinterpretRawPointer(raw, layout);
    assert.ok(view);
    view.value.Second = 17;
    assert.equal(saved.value, 17);
    saved.value = 23;
    assert.equal(view.value.Second, 23);
    view.value = { First: 31, Second: 37 };
    assert.equal(root.value, original);
    assert.deepEqual(original, { First: 31, Second: 37 });
  });

  test(`record padding survives independent aliases and typed field updates: ${order}`, () => {
    const root = location({ First: 1, Second: 2 });
    const layout = pairLayout(order);
    const raw = toRawPointer(root, layout);
    const padding = reinterpretRawPointer(offsetRawPointer(raw, 5), uint8Layout(order, 1, 1));
    assert.ok(padding);
    padding.value = 79;
    root.value.Second = 99;
    const independent = toRawPointer(root, pairLayout(order));
    const retained = reinterpretRawPointer(offsetRawPointer(independent, 5), uint8Layout(order, 1, 1));
    assert.ok(retained);
    assert.equal(retained.value, 79);
  });
}

test("nested record writes preserve nested object identity", () => {
  interface Outer { Inner: Pair; Tail: number }
  const pair = pairLayout("little");
  const word = uint32Layout("little", 4, 4);
  const layout = recordLayout<Outer>("little", 16, 4, 16, [
    recordField<Outer, "Inner">("Inner", 0, pair),
    recordField<Outer, "Tail">("Tail", 12, word),
  ], access => ({
    get Inner() { return access.read(0, pair); },
    set Inner(value: Pair) { access.write(0, pair, value); },
    get Tail() { return access.read(12, word); },
    set Tail(value: number) { access.write(12, word, value); },
  }));
  const inner = { First: 1, Second: 2 };
  const root = location({ Inner: inner, Tail: 3 });
  const saved = propertyLocation(inner, "Second");
  const raw = toRawPointer(root, layout);
  const view = reinterpretRawPointer(raw, layout);
  assert.ok(view);
  view.value.Inner.Second = 41;
  assert.equal(saved.value, 41);
  view.value = { Inner: { First: 43, Second: 47 }, Tail: 53 };
  assert.equal(root.value.Inner, inner);
  assert.equal(saved.value, 47);
});

test("record and its zero-offset field share raw identity, while typed root identity stays distinct", () => {
  const original = { First: 1, Second: 2 };
  const root = location(original);
  const first = propertyLocation(original, "First");
  const second = propertyLocation(original, "Second");
  const firstHash = hashLocation(first);
  const secondHash = hashLocation(second);
  const rootHash = hashLocation(root);
  const layout = pairLayout("little");
  const word = uint32Layout("little", 4, 4);
  const rawFirst = toRawPointer(first, word);
  const raw = toRawPointer(root, layout);
  assert.equal(sameRawPointer(raw, rawFirst), true);
  assert.equal(hashRawPointer(raw), firstHash);
  const rawSecond = offsetRawPointer(raw, 8);
  assert.equal(sameRawPointer(rawSecond, toRawPointer(second, word)), true);
  assert.equal(hashRawPointer(rawSecond), secondHash);
  const whole = reinterpretRawPointer(raw, layout);
  const part = reinterpretRawPointer(rawSecond, word);
  assert.ok(whole);
  assert.ok(part);
  assert.equal(sameLocation(root, whole), true);
  assert.equal(sameLocation(second, part), true);
  assert.equal(hashLocation(root), rootHash);
  assert.equal(hashLocation(whole), rootHash);
});

test("record descriptors reject overlapping, duplicate and incompatible fields", () => {
  const word = uint32Layout("little", 4, 4);
  for (const fields of [
    [recordField<Pair, "First">("First", 0, word), recordField<Pair, "Second">("Second", 0, word)],
    [recordField<Pair, "First">("First", 0, word), recordField<Pair, "First">("First", 4, word)],
    [recordField<Pair, "First">("First", 0, uint32Layout("big", 4, 4))],
    [recordField<Pair, "Second">("Second", 8, word)],
  ]) {
    assert.throws(() => recordLayout<Pair>("little", 8, 4, 8, fields, () => ({ First: 0, Second: 0 })), RangeError);
  }
  assert.throws(() => recordField<Pair, "First">("First", 1, word), RangeError);
});

test("one record location cannot silently acquire a contradictory layout", () => {
  const root = location({ First: 1, Second: 2 });
  toRawPointer(root, pairLayout("little"));
  assert.throws(() => toRawPointer(root, pairLayout("big")), /cannot change/);
});

test("field addresses obtained through independent record views retain the original location", () => {
  const original = { First: 1, Second: 2 };
  const root = location(original);
  const layout = pairLayout("little");
  const raw = toRawPointer(root, layout);
  const first = reinterpretRawPointer(raw, layout);
  const second = reinterpretRawPointer(raw, layout);
  assert.ok(first);
  assert.ok(second);
  const originalField = propertyLocation(original, "Second");
  const firstField = propertyLocation(first.value, "Second");
  const secondField = propertyLocation(second.value, "Second");
  assert.equal(sameLocation(originalField, firstField), true);
  assert.equal(sameLocation(originalField, secondField), true);
  assert.equal(hashLocation(originalField), hashLocation(firstField));
  secondField.value = 61;
  assert.equal(original.Second, 61);
  assert.equal(firstField.value, 61);
});

test("a field obtained from a raw record view retains its containing allocation", () => {
  const original = { First: 3, Second: 5 };
  const layout = pairLayout("little");
  const raw = toRawPointer(location(original), layout);
  const view = reinterpretRawPointer(raw, layout);
  assert.ok(view);
  const field = propertyLocation(view.value, "Second");
  const fieldRaw = toRawPointer(field, uint32Layout("little", 4, 4));
  const start = offsetRawPointer(fieldRaw, -8);
  assert.equal(sameRawPointer(start, raw), true);
  const first = reinterpretRawPointer(start, uint32Layout("little", 4, 4));
  assert.ok(first);
  first.value = 19;
  assert.equal(original.First, 19);
});

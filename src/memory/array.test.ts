import assert from "node:assert/strict";
import test from "node:test";
import { arrayElementLocation, toRawPointer, reinterpretRawPointer, offsetRawPointer, hashRawPointer, sameRawPointer } from "../raw-pointer.js";
import { hashLocation, propertyLocation, sameLocation } from "../location.js";
import { int32Layout, uint8Layout, uint32Layout, uint64Layout } from "./scalars.js";
import { arrayMemory } from "./array.js";

for (const order of ["little", "big"] as const) {
  test(`array addresses retain complete allocation and pre-existing identities: ${order}`, () => {
    const values = [1, 2];
    const layout = uint32Layout(order, 4, 4);
    const existing = propertyLocation(values, 1);
    const hashBefore = hashLocation(existing);
    const first = arrayElementLocation(values, 0, layout);
    const second = arrayElementLocation(values, 1, layout);
    const raw = toRawPointer(first, layout);
    const advanced = offsetRawPointer(raw, 4);
    const view = reinterpretRawPointer(advanced, layout);
    assert.ok(view);
    view.value = 7;
    assert.deepEqual(values, [1, 7]);
    assert.equal(sameRawPointer(advanced, toRawPointer(second, layout)), true);
    assert.equal(sameLocation(view, existing), true);
    assert.equal(hashRawPointer(advanced), hashBefore);
    assert.equal(hashLocation(existing), hashBefore);
    values[1] = 11;
    assert.equal(view.value, 11);
    assert.equal(sameRawPointer(offsetRawPointer(advanced, -4n), raw), true);
    const byte = reinterpretRawPointer(offsetRawPointer(advanced, 1), uint8Layout(order, 1, 1));
    assert.ok(byte);
    byte.value = 3;
    assert.equal(values[1], order === "little" ? 779 : 196619);
  });
}

test("array windows can cross scalar elements without touching other storage", () => {
  const values = [0, 0, 99];
  const layout = uint32Layout("little", 4, 4);
  const raw = toRawPointer(arrayElementLocation(values, 0, layout), layout);
  const both = reinterpretRawPointer(raw, uint64Layout("little", 4, 8));
  assert.ok(both);
  both.value = 0x1122334455667788n;
  assert.deepEqual(values, [0x55667788, 0x11223344, 99]);
  assert.equal(both.value, 0x1122334455667788n);
});

test("array layout padding survives independent views and typed writes", () => {
  const values = [1, 2];
  const layout = uint32Layout("little", 4, 8);
  const first = toRawPointer(arrayElementLocation(values, 0, layout), layout);
  const padding = reinterpretRawPointer(offsetRawPointer(first, 5), uint8Layout("little", 1, 1));
  assert.ok(padding);
  padding.value = 47;
  values[0] = 7;
  const independent = toRawPointer(arrayElementLocation(values, 0, layout), layout);
  const samePadding = reinterpretRawPointer(offsetRawPointer(independent, 5), uint8Layout("little", 1, 1));
  assert.ok(samePadding);
  assert.equal(samePadding.value, 47);
  assert.deepEqual(values, [7, 2]);
});

test("array raw access work is bounded by the selected byte window", () => {
  for (const count of [16, 65_536]) {
    let reads = 0;
    let writes = 0;
    const scalar = uint32Layout("little", 4, 4);
    const counted = { ...scalar,
      read(bytes: DataView): number { reads++; return scalar.read(bytes); },
      write(bytes: DataView, value: number): void { writes++; scalar.write(bytes, value); },
    };
    const values = new Array<number>(count).fill(1);
    const raw = toRawPointer(arrayElementLocation(values, count - 1, counted), counted);
    const byte = reinterpretRawPointer(raw, uint8Layout("little", 1, 1));
    assert.ok(byte);
    byte.value = 7;
    assert.equal(byte.value, 7);
    assert.equal(values[count - 1], 7);
    assert.equal(reads, 1);
    assert.equal(writes, 2);
  }
});

test("array allocations reject invalid indexes, changed extent and conflicting layouts", () => {
  const layout = uint32Layout("little", 4, 4);
  const values = [1, 2];
  for (const index of [-1, 3, 0.5, NaN, Infinity]) {
    assert.throws(() => arrayElementLocation(values, index, layout), RangeError);
  }
  const raw = toRawPointer(arrayElementLocation(values, 0, layout), layout);
  assert.throws(() => arrayMemory(values, int32Layout("little", 4, 4)), /selected element layout/);
  assert.throws(() => arrayMemory(values, uint32Layout("big", 4, 4)), /selected element layout/);
  assert.throws(() => offsetRawPointer(raw, 9), RangeError);
  const end = arrayElementLocation(values, values.length, layout);
  const endRaw = offsetRawPointer(raw, 8);
  assert.equal(sameRawPointer(toRawPointer(end, layout), endRaw), true);
  const restoredEnd = reinterpretRawPointer(endRaw, layout);
  assert.ok(restoredEnd);
  assert.equal(sameLocation(restoredEnd, end), true);
  assert.throws(() => end.value, RangeError);
  assert.throws(() => { end.value = 3; }, RangeError);
  assert.throws(() => restoredEnd.value, RangeError);
  assert.throws(() => { restoredEnd.value = 3; }, RangeError);
  values.push(3);
  assert.throws(() => reinterpretRawPointer(raw, layout)?.value, /resize/);
});

test("different arrays do not share allocation identity", () => {
  const layout = uint32Layout("little", 4, 4);
  const first = toRawPointer(arrayElementLocation([1, 2], 0, layout), layout);
  const second = toRawPointer(arrayElementLocation([1, 2], 0, layout), layout);
  assert.equal(sameRawPointer(first, second), false);
});

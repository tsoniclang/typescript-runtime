import assert from "node:assert/strict";
import test from "node:test";
import type { FixedArray } from "../fixed-array.js";
import { location, sameLocation } from "../location.js";
import type { Location } from "../location.js";
import { hashRawPointer, offsetRawPointer, reinterpretRawPointer, sameRawPointer, toRawPointer } from "../raw-pointer.js";
import { arrayAddressLayout } from "./array-address.js";
import { identityLayout } from "./identity.js";
import { sameMemoryLayout } from "./layout.js";
import { uint8Layout, uint16Layout, uint32Layout } from "./scalars.js";

for (const order of ["little", "big"] as const) {
  test(`array addresses preserve identity without reading their elements: ${order}`, () => {
    const layout = arrayAddressLayout(order, 8, 4, 8, uint32Layout(order, 4, 4), 2);
    const equivalent = arrayAddressLayout(order, 8, 4, 8, uint32Layout(order, 4, 4), 2);
    const values: [number, number] = [11, 13];
    let reads = 0;
    let writes = 0;
    const pointer: Location<FixedArray<number, 2>> = {
      storageIdentity: {}, storageKey: undefined,
      get value() { reads++; return values; },
      set value(_value) { writes++; throw new Error("unexpected array assignment"); },
    };
    const raw = toRawPointer(pointer, layout);
    const repeated = toRawPointer(pointer, equivalent);
    const view = reinterpretRawPointer(raw, equivalent);
    assert.ok(view);
    assert.equal(sameRawPointer(raw, repeated), true);
    assert.equal(hashRawPointer(raw), hashRawPointer(repeated));
    assert.equal(sameLocation(pointer, view), true);
    assert.equal(sameRawPointer(raw, toRawPointer(view, equivalent)), true);
    assert.equal(sameRawPointer(raw, toRawPointer(location(values), layout)), false);
    assert.equal(toRawPointer(undefined, layout), undefined);
    assert.equal(reinterpretRawPointer(undefined, layout), undefined);
    assert.equal(reads, 0);
    assert.equal(writes, 0);
    assert.throws(() => view.value, /array-address layout has no byte codec/);
    assert.throws(() => { view.value = values; }, /array-address layout has no byte codec/);
    const byte = reinterpretRawPointer(raw, uint8Layout(order, 1, 1));
    assert.ok(byte);
    assert.throws(() => byte.value, /array-address layout has no byte codec/);
    assert.throws(() => { byte.value = 7; }, /array-address layout has no byte codec/);
    assert.equal(reads, 0);
    assert.equal(writes, 0);
    assert.deepEqual(values, [11, 13]);
    assert.throws(() => reinterpretRawPointer(offsetRawPointer(raw, 4), layout), /exceeds its storage/);
    assert.throws(() => offsetRawPointer(raw, 9), /outside its retained storage/);
  });
}

test("array domains retain count, child shape and whole-array stride independently", () => {
  const word = uint32Layout("little", 4, 4);
  const layout = arrayAddressLayout("little", 16, 4, 16, word, 2);
  const same = arrayAddressLayout("little", 16, 4, 16, uint32Layout("little", 4, 4), 2);
  const changedChild = arrayAddressLayout("little", 16, 4, 16, uint16Layout("little", 2, 4), 2);
  const different = [
    arrayAddressLayout("little", 16, 4, 16, word, 3),
    arrayAddressLayout("little", 16, 4, 16, word, 2n),
    changedChild,
    arrayAddressLayout("little", 16, 4, 20, word, 2),
    arrayAddressLayout("big", 16, 4, 16, uint32Layout("big", 4, 4), 2),
  ];
  assert.equal(sameMemoryLayout(layout, same), true);
  for (const other of different) assert.equal(sameMemoryLayout(layout, other), false);
  const nested = arrayAddressLayout("little", 32, 4, 32, layout, 2);
  const changed = arrayAddressLayout("little", 32, 4, 32, changedChild, 2);
  assert.equal(sameMemoryLayout(nested, changed), false);
});

test("empty and huge zero-sized array addresses do not enumerate or read storage", () => {
  const huge = 9007199254740993n;
  const empty = identityLayout<undefined>("zero", "little", 0, 1, 0);
  const layout = arrayAddressLayout("little", 0, 1, 0, empty, huge);
  const values: FixedArray<undefined, typeof huge> = { length: huge, *[Symbol.iterator]() { throw new Error("unexpected enumeration"); } };
  const stored = location(values);
  const raw = toRawPointer(stored, layout);
  const view = reinterpretRawPointer(raw, layout);
  assert.ok(view);
  assert.equal(layout.array?.length, huge);
  assert.equal(sameLocation(stored, view), true);
  assert.throws(() => view.value, /array-address/);
  assert.throws(() => offsetRawPointer(raw, 1), /outside its retained storage/);
  const zero = arrayAddressLayout("little", 0, 1, 0, uint32Layout("little", 4, 4), 0);
  const tuple: [] = [];
  assert.ok(toRawPointer(location(tuple), zero));
});

test("array address byte rejection precedes byte-sized scratch allocation", () => {
  const size = Number.MAX_SAFE_INTEGER - 7;
  const empty = identityLayout<undefined>("zero", "little", 0, 1, 0);
  const layout = arrayAddressLayout("little", size, 8, size, empty, 0);
  const values: [] = [];
  const raw = toRawPointer(location(values), layout);
  const byte = reinterpretRawPointer(raw, uint8Layout("little", 1, 1));
  assert.ok(byte);
  assert.throws(() => byte.value, /array-address layout has no byte codec/);
  assert.throws(() => { byte.value = 1; }, /array-address layout has no byte codec/);
});

test("array address dimensions cannot shorten or misalign the selected child extent", () => {
  const word = uint32Layout("little", 4, 8);
  assert.throws(() => arrayAddressLayout("little", 8, 4, 8, word, 2), /element extent/);
  assert.throws(() => arrayAddressLayout("little", 12, 2, 12, word, 2), /alignment/);
  assert.throws(() => arrayAddressLayout("big", 12, 4, 12, word, 2), /byte order/);
  assert.throws(() => arrayAddressLayout("little", 12, 4, 12, word, 1.5), /exact non-negative extent/);
  assert.throws(() => arrayAddressLayout("little", 12, 4, 12, word, -1n), /exact non-negative extent/);
  assert.throws(() => arrayAddressLayout("little", 12, 4, 12, word, Number.MAX_SAFE_INTEGER + 1), /exact non-negative extent/);
  assert.throws(() => arrayAddressLayout("little", 12, 3, 12, word, 2), /alignment/);
  assert.throws(() => arrayAddressLayout("little", 12, 4, 8, word, 2), /stride/);
  assert.equal(arrayAddressLayout("little", 12, 4, 12, word, 2).byteSize, 12);
  assert.equal(arrayAddressLayout("little", 16, 4, 16, word, 2).byteSize, 16);
});

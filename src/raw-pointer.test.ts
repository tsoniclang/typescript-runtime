import assert from "node:assert/strict";
import test from "node:test";

import {
  hashRawPointer,
  toRawPointer,
  reinterpretRawPointer,
  offsetRawPointer,
  sameRawPointer,
} from "./raw-pointer.js";
import { location, propertyLocation, projectLocation, sameLocation, hashLocation } from "./location.js";
import { int32Layout, uint8Layout, uint16Layout, uint32Layout, int64Layout } from "./memory/scalars.js";

test("raw pointers preserve storage identity across independent conversions", () => {
  const identity = location(7);
  const layout = int32Layout("little", 4, 4);
  const first = toRawPointer(identity, layout);
  const alias = toRawPointer(identity, layout);
  const other = toRawPointer(location(7), layout);

  assert.equal(sameRawPointer(first, alias), true);
  assert.equal(hashRawPointer(first), hashRawPointer(alias));
  assert.equal(sameRawPointer(first, other), false);
  assert.notEqual(hashRawPointer(first), hashRawPointer(other));
});

test("raw-pointer nil equality and hashing are stable", () => {
  const pointer = toRawPointer(location(0), int32Layout("little", 4, 4));

  assert.equal(sameRawPointer(undefined, undefined), true);
  assert.equal(sameRawPointer(pointer, undefined), false);
  assert.equal(hashRawPointer(undefined), 0);
  assert.equal(hashRawPointer(pointer), hashRawPointer(pointer));
});

test("reinterpretation reads live storage and writes through to the original location", () => {
  const original = location(1);
  const layout = int32Layout("little", 4, 4);
  const raw = toRawPointer(original, layout);
  const alias = reinterpretRawPointer(raw, layout);
  assert.ok(alias);
  original.value = 12;
  assert.equal(alias.value, 12);
  alias.value = 27;
  assert.equal(original.value, 27);
  assert.equal(sameLocation(original, alias), true);
  assert.equal(hashLocation(original), hashLocation(alias));
  assert.equal(sameRawPointer(toRawPointer(alias, layout), raw), true);
});

for (const order of ["little", "big"] as const) {
  test(`byte writes preserve aliased integer storage with ${order} byte order`, () => {
    const original = location(0x11223344);
    const raw = toRawPointer(original, uint32Layout(order, 4, 4));
    const second = offsetRawPointer(raw, 1n);
    const byte = reinterpretRawPointer(second, uint8Layout(order, 1, 1));
    assert.ok(byte);
    assert.equal(byte.value, order === "little" ? 0x33 : 0x22);
    byte.value = 0xab;
    assert.equal(original.value, order === "little" ? 0x1122ab44 : 0x11ab3344);
    assert.equal(sameRawPointer(second, offsetRawPointer(raw, 1)), true);
    assert.equal(sameRawPointer(offsetRawPointer(second, -1n), raw), true);
    assert.equal(hashRawPointer(second), hashRawPointer(toRawPointer(byte, uint8Layout(order, 1, 1))));
  });
}

test("property and projected locations preserve the same writable raw address", () => {
  const value = { count: 1, other: 1 };
  const layout = int32Layout("little", 4, 4);
  const first = propertyLocation(value, "count");
  const second = propertyLocation(value, "count");
  assert.equal(sameRawPointer(toRawPointer(first, layout), toRawPointer(second, layout)), true);
  const alias = reinterpretRawPointer(toRawPointer(first, layout), layout);
  assert.ok(alias);
  const projected = projectLocation(alias, value => value, value => value);
  const raw = toRawPointer(projected, layout);
  assert.equal(sameRawPointer(raw, toRawPointer(first, layout)), true);
  projected.value = 9;
  assert.equal(value.count, 9);
  assert.equal(value.other, 1);
});

test("nil, exact offsets, alignment and retained allocation bounds fail closed", () => {
  const layout = int32Layout("little", 4, 4);
  assert.equal(toRawPointer(undefined, layout), undefined);
  assert.equal(reinterpretRawPointer(undefined, layout), undefined);
  assert.equal(offsetRawPointer(undefined, 0n), undefined);
  assert.throws(() => offsetRawPointer(undefined, 1), RangeError);
  const raw = toRawPointer(location(0), layout);
  for (const offset of [-1, 5, 1.5, NaN, Infinity, 1n << 100n]) {
    assert.throws(() => offsetRawPointer(raw, offset), RangeError);
  }
  assert.throws(() => reinterpretRawPointer(offsetRawPointer(raw, 1), uint16Layout("little", 2, 2)), RangeError);
  assert.throws(() => reinterpretRawPointer(offsetRawPointer(raw, 4), uint8Layout("little", 1, 1)), RangeError);
  assert.throws(() => reinterpretRawPointer(raw, int64Layout("little", 8, 8)), RangeError);
});

test("64-bit values remain exact across byte updates", () => {
  const original = location(0x1122334455667788n);
  const raw = toRawPointer(original, int64Layout("little", 8, 8));
  const byte = reinterpretRawPointer(offsetRawPointer(raw, 7n), uint8Layout("little", 1, 1));
  assert.ok(byte);
  byte.value = 0x22;
  assert.equal(original.value, 0x2222334455667788n);
});

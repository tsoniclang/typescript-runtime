import assert from "node:assert/strict";
import test from "node:test";
import { location } from "../location.js";
import { offsetRawPointer, reinterpretRawPointer, toRawPointer } from "../raw-pointer.js";
import { uint8Layout, uint32Layout, uint64Layout } from "./scalars.js";

for (const order of ["little", "big"] as const) {
  test(`source uint64 alignment is independent of width: ${order}`, () => {
    const layout = uint64Layout(order, 4, 8);
    assert.equal(layout.byteSize, 8);
    assert.equal(layout.byteAlignment, 4);
    assert.equal(layout.stride, 8);
    const value = location(0x1122334455667788n);
    const raw = toRawPointer(value, layout);
    const view = reinterpretRawPointer(raw, layout);
    assert.ok(view);
    assert.equal(view.value, value.value);
    assert.throws(() => reinterpretRawPointer(raw, uint64Layout(order, 8, 8)), RangeError);
    const byte = reinterpretRawPointer(offsetRawPointer(raw, 7), uint8Layout(order, 1, 1));
    assert.ok(byte);
    byte.value = 0x22;
    assert.equal(value.value, order === "little" ? 0x2222334455667788n : 0x1122334455667722n);
  });
}

test("explicit scalar stride is retained without enlarging its pointee storage", () => {
  const layout = uint32Layout("little", 8, 16);
  assert.equal(layout.byteSize, 4);
  assert.equal(layout.byteAlignment, 8);
  assert.equal(layout.stride, 16);
  const pointer = toRawPointer(location(7), layout);
  assert.throws(() => offsetRawPointer(pointer, 16), RangeError);
});

test("invalid explicit scalar dimensions fail at construction", () => {
  for (const alignment of [0, -1, 3, 1.5, NaN, Infinity]) {
    assert.throws(() => uint64Layout("little", alignment, 8), RangeError);
  }
  for (const stride of [0, 4, 9, -1, NaN, Infinity]) {
    assert.throws(() => uint64Layout("little", 4, stride), RangeError);
  }
});

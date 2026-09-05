import assert from "node:assert/strict";
import test from "node:test";
import { location } from "../location.js";
import { toRawPointer, reinterpretRawPointer, offsetRawPointer } from "../raw-pointer.js";
import {
  int8Layout, uint8Layout, int16Layout, uint16Layout,
  int32Layout, uint32Layout, int64Layout, uint64Layout,
} from "./scalars.js";

for (const order of ["little", "big"] as const) {
  test(`all integer codecs preserve their full ${order}-endian domain`, () => {
    const numbers = [
      { layout: int8Layout(order), low: -128, high: 127 },
      { layout: uint8Layout(order), low: 0, high: 255 },
      { layout: int16Layout(order), low: -32768, high: 32767 },
      { layout: uint16Layout(order), low: 0, high: 65535 },
      { layout: int32Layout(order), low: -2147483648, high: 2147483647 },
      { layout: uint32Layout(order), low: 0, high: 4294967295 },
    ];
    for (const { layout, low, high } of numbers) {
      const original = location(low);
      const alias = reinterpretRawPointer(toRawPointer(original, layout), layout);
      assert.ok(alias);
      assert.equal(alias.value, low);
      alias.value = high;
      assert.equal(original.value, high);
      original.value = low;
      assert.equal(alias.value, low);
    }
    const wide = [
      { layout: int64Layout(order), low: -(1n << 63n), high: (1n << 63n) - 1n },
      { layout: uint64Layout(order), low: 0n, high: (1n << 64n) - 1n },
    ];
    for (const { layout, low, high } of wide) {
      const original = location(low);
      const raw = toRawPointer(original, layout);
      const alias = reinterpretRawPointer(raw, layout);
      assert.ok(alias);
      alias.value = high;
      assert.equal(original.value, high);
      const lowByte = reinterpretRawPointer(offsetRawPointer(raw, order === "little" ? 0 : 7), uint8Layout(order));
      assert.ok(lowByte);
      lowByte.value = 0;
      assert.equal(original.value, high & ~255n);
    }
  });
}

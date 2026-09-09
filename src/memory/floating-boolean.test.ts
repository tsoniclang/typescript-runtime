import assert from "node:assert/strict";
import test from "node:test";
import { location } from "../location.js";
import { reinterpretRawPointer, toRawPointer } from "../raw-pointer.js";
import { booleanLayout, float32Layout, float64Layout, uint8Layout, uint32Layout, uint64Layout } from "./scalars.js";

for (const order of ["little", "big"] as const) {
  test(`boolean memory has exact bytes and writable aliases: ${order}`, () => {
    const flag = location(false);
    const layout = booleanLayout(order, 1, 1);
    const raw = toRawPointer(flag, layout);
    const byte = reinterpretRawPointer(raw, uint8Layout(order, 1, 1));
    const alias = reinterpretRawPointer(raw, layout);
    assert.ok(byte);
    assert.ok(alias);
    assert.equal(byte.value, 0);
    byte.value = 1;
    assert.equal(flag.value, true);
    flag.value = false;
    assert.equal(byte.value, 0);
    alias.value = true;
    assert.equal(byte.value, 1);
    assert.throws(() => { byte.value = 2; }, /canonical zero or one/);
    assert.equal(flag.value, true);
  });

  test(`floating memory preserves IEEE values, bytes and aliases: ${order}`, () => {
    const small = float32Layout(order, 4, 4);
    const large = float64Layout(order, 4, 8);
    const singles = [
      { value: 0, bits: 0 }, { value: -0, bits: 0x80000000 },
      { value: 1.5, bits: 0x3fc00000 }, { value: -2.5, bits: 0xc0200000 },
      { value: 2 ** -149, bits: 1 }, { value: Infinity, bits: 0x7f800000 },
      { value: -Infinity, bits: 0xff800000 },
    ];
    for (const { value, bits } of singles) {
      const original = location(value);
      const raw = toRawPointer(original, small);
      const word = reinterpretRawPointer(raw, uint32Layout(order, 4, 4));
      assert.ok(word);
      assert.equal(word.value, bits);
      word.value = 0x40400000;
      assert.equal(original.value, 3);
      word.value = bits;
      assert.ok(Object.is(original.value, value));
    }
    const doubles = [
      { value: 0, bits: 0n }, { value: -0, bits: 0x8000000000000000n },
      { value: 1.5, bits: 0x3ff8000000000000n }, { value: -2.5, bits: 0xc004000000000000n },
      { value: Number.MIN_VALUE, bits: 1n }, { value: Infinity, bits: 0x7ff0000000000000n },
      { value: -Infinity, bits: 0xfff0000000000000n },
    ];
    for (const { value, bits } of doubles) {
      const original = location(value);
      const raw = toRawPointer(original, large);
      const word = reinterpretRawPointer(raw, uint64Layout(order, 4, 8));
      assert.ok(word);
      assert.equal(word.value, bits);
      word.value = 0x4008000000000000n;
      assert.equal(original.value, 3);
      word.value = bits;
      assert.ok(Object.is(original.value, value));
    }
    const bytes = new DataView(new ArrayBuffer(4));
    small.write(bytes, 1 + 2 ** -24);
    assert.equal(small.read(bytes), 1);
  });

  test(`NaN payloads fail explicitly instead of being normalized: ${order}`, () => {
    const little = order === "little";
    const small = float32Layout(order, 4, 4);
    const large = float64Layout(order, 8, 8);
    const singleBytes = new DataView(new ArrayBuffer(4));
    const doubleBytes = new DataView(new ArrayBuffer(8));
    for (const bits of [0x7f800001, 0x7fc00001, 0xffc01234]) {
      singleBytes.setUint32(0, bits, little);
      assert.throws(() => small.read(singleBytes), /NaN payloads/);
    }
    for (const bits of [0x7ff0000000000001n, 0x7ff8000000000001n, 0xfff8000000001234n]) {
      doubleBytes.setBigUint64(0, bits, little);
      assert.throws(() => large.read(doubleBytes), /NaN payloads/);
    }
    assert.throws(() => small.write(singleBytes, NaN), /NaN payloads/);
    assert.throws(() => large.write(doubleBytes, NaN), /NaN payloads/);
  });
}

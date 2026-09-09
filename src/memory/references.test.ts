import assert from "node:assert/strict";
import test from "node:test";
import { location, sameLocation } from "../location.js";
import { offsetRawPointer, reinterpretRawPointer, toRawPointer } from "../raw-pointer.js";
import { referenceLayout } from "./references.js";
import { readMemoryBytes, writeMemoryBytes } from "./bytes.js";
import { uint8Layout } from "./scalars.js";
import { recordField, recordLayout } from "./record.js";

for (const order of ["little", "big"] as const) {
  for (const width of [4, 8]) {
    test(`managed references preserve nil, copying and replacement: ${order}/${width}`, () => {
      const first = location(3);
      const second = location(7);
      const layout = referenceLayout<typeof first>(order, width, width, width);
      const slot = location<typeof first | undefined>(first);
      const raw = toRawPointer(slot, layout);
      const view = reinterpretRawPointer(raw, layout);
      assert.ok(view);
      assert.equal(sameLocation(view.value, first), true);
      view.value = second;
      assert.equal(sameLocation(slot.value, second), true);
      assert.equal(first.value, 3);
      const bytes = new DataView(new ArrayBuffer(width));
      layout.write(bytes, first);
      const copied = readMemoryBytes(bytes, 0, width);
      const destination = new DataView(new ArrayBuffer(width));
      writeMemoryBytes(destination, 0, copied);
      assert.equal(sameLocation(layout.read(destination), first), true);
      layout.write(bytes, second);
      assert.equal(sameLocation(layout.read(destination), first), true);
      view.value = undefined;
      assert.equal(slot.value, undefined);
      assert.equal(layout.read(new DataView(new ArrayBuffer(width))), undefined);
    });
  }
}

test("reference domains and opaque pointer bytes are never guessed", () => {
  const pointer = location(3);
  const selected = referenceLayout<typeof pointer>("little", 8, 8, 8);
  const other = referenceLayout<typeof pointer>("little", 8, 8, 8);
  const bytes = new DataView(new ArrayBuffer(8));
  selected.write(bytes, pointer);
  assert.throws(() => other.read(bytes), /domain/);
  assert.throws(() => readMemoryBytes(bytes, 1, 7), /split/);
  const raw = toRawPointer(location<typeof pointer | undefined>(pointer), selected);
  const part = reinterpretRawPointer(offsetRawPointer(raw, 1), uint8Layout("little", 1, 1));
  assert.ok(part);
  assert.throws(() => part.value, /split|native pointer bits/);
  assert.throws(() => { part.value = 1; }, /split|native pointer bits/);
  assert.equal(sameLocation(selected.read(bytes), pointer), true);
  const malformed = new DataView(new ArrayBuffer(8));
  malformed.setUint8(0, 1);
  assert.throws(() => selected.read(malformed), /unproven native address/);
  assert.throws(() => referenceLayout<typeof pointer>("little", 3, 1, 3), /width/);
});

test("pointer-bearing record writes replace the field without replacing its pointee", () => {
  const first = location(3);
  const second = location(5);
  type Holder = { pointer: typeof first | undefined };
  const pointer = referenceLayout<typeof first>("little", 8, 8, 8);
  const layout = recordLayout<Holder>("little", 8, 8, 8, [recordField<Holder, "pointer">("pointer", 0, pointer)], access => ({
    get pointer() { return access.read(0, pointer); },
    set pointer(value: typeof first | undefined) { access.write(0, pointer, value); },
  }));
  const original: Holder = { pointer: first };
  const raw = toRawPointer(location(original), layout);
  const view = reinterpretRawPointer(raw, layout);
  assert.ok(view);
  assert.equal(sameLocation(view.value.pointer, first), true);
  const copied = view.value.pointer;
  view.value.pointer = second;
  assert.equal(sameLocation(original.pointer, second), true);
  assert.equal(sameLocation(copied, first), true);
  assert.equal(first.value, 3);
  view.value = { pointer: undefined };
  assert.equal(original.pointer, undefined);
});

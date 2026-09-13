import assert from "node:assert/strict";
import test from "node:test";
import { location } from "../location.js";
import { offsetRawPointer, reinterpretRawPointer, toRawPointer } from "../raw-pointer.js";
import { recordField, recordLayout } from "./record.js";
import { uint32Layout } from "./scalars.js";

test("nested record writes commit through a logical field accessor", () => {
  interface Header { Length: number; Capacity: number }
  interface RecordValue { Header: Header; Sentinel: number }
  const word = uint32Layout("little", 4, 4);
  const header = recordLayout<Header>("little", 8, 4, 8, [
    recordField<Header, "Length">("Length", 0, word),
    recordField<Header, "Capacity">("Capacity", 4, word),
  ], access => ({
    get Length() { return access.read(0, word); },
    set Length(value: number) { access.write(0, word, value); },
    get Capacity() { return access.read(4, word); },
    set Capacity(value: number) { access.write(4, word, value); },
  }));
  const layout = recordLayout<RecordValue>("little", 12, 4, 12, [
    recordField<RecordValue, "Header">("Header", 0, header),
    recordField<RecordValue, "Sentinel">("Sentinel", 8, word),
  ], access => ({
    get Header() { return access.read(0, header); },
    set Header(value: Header) { access.write(0, header, value); },
    get Sentinel() { return access.read(8, word); },
    set Sentinel(value: number) { access.write(8, word, value); },
  }));
  let logical: Readonly<{ length: number; capacity: number }> = Object.freeze({ length: 2, capacity: 7 });
  const saved = logical;
  let writes = 0;
  const record: RecordValue = {
    get Header() { return { Length: logical.length, Capacity: logical.capacity }; },
    set Header(value: Header) {
      logical = Object.freeze({ length: value.Length, capacity: value.Capacity });
      writes++;
    },
    Sentinel: 31,
  };
  const raw = toRawPointer(location(record), layout);
  const length = reinterpretRawPointer(raw, word);
  const capacity = reinterpretRawPointer(offsetRawPointer(raw, 4), word);
  assert.ok(length);
  assert.ok(capacity);
  length.value = 5;
  assert.deepEqual(logical, { length: 5, capacity: 7 });
  capacity.value = 9;
  assert.deepEqual(logical, { length: 5, capacity: 9 });
  assert.deepEqual(saved, { length: 2, capacity: 7 });
  assert.equal(record.Sentinel, 31);
  assert.equal(writes, 2);
  logical = Object.freeze({ length: 3, capacity: 11 });
  assert.equal(length.value, 3);
  assert.equal(capacity.value, 11);
});

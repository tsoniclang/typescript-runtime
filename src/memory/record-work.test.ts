import assert from "node:assert/strict";
import test from "node:test";
import { location } from "../location.js";
import { offsetRawPointer, reinterpretRawPointer, toRawPointer } from "../raw-pointer.js";
import { recordField, recordLayout } from "./record.js";
import { uint32Layout } from "./scalars.js";

test("narrow record reads and writes visit only their selected field", () => {
  for (const width of [16, 2048]) {
    let reads = 0;
    let writes = 0;
    let probes = 0;
    const values: Record<string, number> = {};
    const word = { ...uint32Layout("little", 4, 4), get byteSize() { probes++; return 4; } };
    const fields = Array.from({ length: width }, (_, index) => {
      const key = `value${index}`;
      let current = index;
      Object.defineProperty(values, key, {
        get() { reads++; return current; },
        set(value: number) { writes++; current = value; },
      });
      return recordField<Record<string, number>, string>(key, index * 4, word);
    });
    const layout = recordLayout("little", width * 4, 4, width * 4, fields, () => values);
    const raw = toRawPointer(location(values), layout);
    const selected = reinterpretRawPointer(offsetRawPointer(raw, (width - 1) * 4), uint32Layout("little", 4, 4));
    assert.ok(selected);
    reads = 0;
    probes = 0;
    assert.equal(selected.value, width - 1);
    assert.equal(reads, 1);
    assert.ok(probes <= 20, `read field probes=${probes}, width=${width}`);
    reads = 0;
    writes = 0;
    probes = 0;
    selected.value = 71;
    assert.equal(reads, 1);
    assert.equal(writes, 1);
    assert.ok(probes <= 40, `write field probes=${probes}, width=${width}`);
    reads = 0;
    layout.write(new DataView(new ArrayBuffer(width * 4)), values);
    assert.equal(reads, width);
  }
});

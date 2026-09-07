import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { keepAlive } from "../lifetime.js";

const collector = globalThis.gc;
assert.ok(collector);
const mode = process.argv[2];
assert.ok(mode === "keep" || mode === "omit");
const holder: { value: { resource: { id: number } } | undefined } = { value: { resource: { id: 7 } } };
assert.ok(holder.value);
const reference = new WeakRef(holder.value.resource);
await setImmediate();

function release(): void {
  const value = holder.value;
  holder.value = undefined;
  if (mode === "keep") keepAlive(value);
}

release();
collector();
const retained = reference.deref() !== undefined;
assert.equal(retained, mode === "keep");
let released = false;
for (let attempt = 0; attempt < 8; attempt++) {
  await setImmediate();
  collector();
  if (reference.deref() === undefined) {
    released = true;
    break;
  }
}
assert.equal(released, true);
process.stdout.write(`${mode}:retained=${retained}:released=${released}\n`);

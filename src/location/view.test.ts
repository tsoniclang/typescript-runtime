import assert from "node:assert/strict";
import { test } from "node:test";
import { boundLocation, projectLocation, sameLocation, viewLocation } from "../location.js";

test("a pointer view never reads or writes its retained base", () => {
  const base = boundLocation({}, () => { throw new Error("base read"); }, () => { throw new Error("base write"); });
  let reads = 0;
  let writes = 0;
  let value = 3;
  const view = viewLocation(base, () => { reads++; return value; }, next => { writes++; value = next; });
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  assert.equal(sameLocation(view, viewLocation(base, () => 0, () => {})), true);
  assert.equal(view.value, 3);
  view.value = 7;
  assert.equal(value, 7);
  assert.equal(reads, 1);
  assert.equal(writes, 1);
  assert.throws(() => projectLocation(base, () => 0, () => { throw new Error("conversion"); }).value, /base read/);
});

test("nil views evaluate callback arguments but never invoke callbacks", () => {
  let evaluations = 0;
  const read = () => { evaluations++; return () => { throw new Error("read"); }; };
  const write = () => { evaluations++; return () => { throw new Error("write"); }; };
  assert.equal(viewLocation(undefined, read(), write()), undefined);
  assert.equal(evaluations, 2);
});

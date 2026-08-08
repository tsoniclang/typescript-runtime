import assert from "node:assert/strict";
import test from "node:test";

import {
  hashRawPointer,
  rawPointer,
  sameRawPointer,
} from "./raw-pointer.js";

test("raw pointers preserve opaque identity across independent bindings", () => {
  const identity = {};
  const first = rawPointer(identity);
  const alias = rawPointer(identity);
  const other = rawPointer({});

  assert.equal(first, alias);
  assert.equal(sameRawPointer(first, alias), true);
  assert.equal(hashRawPointer(first), hashRawPointer(alias));
  assert.equal(sameRawPointer(first, other), false);
  assert.notEqual(hashRawPointer(first), hashRawPointer(other));
});

test("raw-pointer nil equality and hashing are stable", () => {
  const pointer = rawPointer({});

  assert.equal(sameRawPointer(undefined, undefined), true);
  assert.equal(sameRawPointer(pointer, undefined), false);
  assert.equal(hashRawPointer(undefined), 0);
  assert.equal(hashRawPointer(pointer), hashRawPointer(pointer));
});

import assert from "node:assert/strict";
import test from "node:test";
import { boundLocation, hashLocation, hashObjectIdentity, hashRawPointer, identityLayout, toRawPointer } from "./index.js";

test("direct, bound and raw identities share one stable hash owner", () => {
  const object = {};
  const pointer = boundLocation(object, () => object, () => {});
  const raw = toRawPointer(pointer, identityLayout<object>("zero", "little", 0, 1, 0));
  assert.equal(hashObjectIdentity(object), hashLocation(pointer));
  assert.equal(hashObjectIdentity(object), hashRawPointer(raw));
  assert.equal(hashObjectIdentity(undefined), 0);
  assert.equal(hashObjectIdentity(object), hashObjectIdentity(object));
  assert.notEqual(hashObjectIdentity(object), hashObjectIdentity({}));
});

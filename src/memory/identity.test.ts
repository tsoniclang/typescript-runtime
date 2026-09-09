import assert from "node:assert/strict";
import test from "node:test";
import { identityLayout } from "./identity.js";
import { uint8Layout } from "./scalars.js";
import { arrayMemory } from "./array.js";
import { location } from "../location.js";
import { hashRawPointer, reinterpretRawPointer, sameRawPointer, toRawPointer } from "../raw-pointer.js";

test("identity-only descriptors preserve addresses without inventing scalar bytes", () => {
  const layout = identityLayout<number>("number", "little", 8, 8, 8);
  const value = location(12);
  const raw = toRawPointer(value, layout);
  assert.equal(sameRawPointer(raw, toRawPointer(value, layout)), true);
  assert.equal(hashRawPointer(raw), hashRawPointer(toRawPointer(value, layout)));
  assert.equal(sameRawPointer(raw, toRawPointer(location(12), layout)), false);
  assert.equal(toRawPointer(undefined, layout), undefined);
  const byte = reinterpretRawPointer(raw, uint8Layout("little", 1, 1));
  assert.ok(byte);
  assert.throws(() => byte.value, /identity-only/);
  assert.throws(() => { byte.value = 2; }, /identity-only/);
  assert.equal(value.value, 12);
});

test("zero-sized values retain independent identity and reject array byte addressing", () => {
  const layout = identityLayout<object>("zero", "little", 0, 1, 0);
  const value = location({});
  const raw = toRawPointer(value, layout);
  assert.equal(sameRawPointer(raw, toRawPointer(value, layout)), true);
  assert.equal(sameRawPointer(raw, toRawPointer(location({}), layout)), false);
  const view = reinterpretRawPointer(raw, layout);
  assert.ok(view);
  assert.throws(() => view.value, /identity-only/);
  assert.throws(() => arrayMemory([{}], layout), /positive element stride/);
});

test("identity descriptors validate their explicit domain and layout", () => {
  assert.throws(() => identityLayout<number>("number", "little", 0, 1, 0), /identity/);
  assert.throws(() => identityLayout<object>("zero", "little", 8, 8, 8), /identity/);
  assert.throws(() => identityLayout<bigint>("bigint", "little", 8, 3, 8), /alignment/);
  const layout = identityLayout<bigint>("bigint", "big", 8, 8, 8);
  const value = location(7n);
  assert.ok(toRawPointer(value, layout));
  assert.throws(() => toRawPointer(value, identityLayout<bigint>("number", "big", 8, 8, 8)), /change its selected layout/);
});

test("retaining identity allocates no byte-sized scratch", () => {
  const bytes = Number.MAX_SAFE_INTEGER - 7;
  const layout = identityLayout<number>("number", "little", bytes, 8, bytes);
  assert.ok(toRawPointer(location(1), layout));
});

import assert from "node:assert/strict";
import test from "node:test";

import { location, propertyLocation } from "./location.js";

test("aliases observe the same location", () => {
  const original = location(10);
  const alias = original;

  alias.value += 1;

  assert.equal(original.value, 11);
  assert.equal(alias, original);
});

test("allocations have independent identity", () => {
  const first = location(10);
  const second = location(10);

  first.value = 20;

  assert.notEqual(first, second);
  assert.equal(first.value, 20);
  assert.equal(second.value, 10);
});

test("property locations evaluate their base and key once", () => {
  const values = [10, 20];
  let baseEvaluations = 0;
  let keyEvaluations = 0;
  const pointer = propertyLocation(
    (baseEvaluations += 1, values),
    (keyEvaluations += 1, 1),
  );

  assert.equal(pointer.value, 20);
  pointer.value = 25;
  assert.deepEqual(values, [10, 25]);
  assert.equal(baseEvaluations, 1);
  assert.equal(keyEvaluations, 1);
});

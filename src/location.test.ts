import assert from "node:assert/strict";
import test from "node:test";

import {
  location,
  hashLocation,
  nestedPropertyLocation,
  propertyLocation,
  projectLocation,
  sameLocation,
} from "./location.js";

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

test("property locations compare by exact storage identity and key", () => {
  const first = { value: 10, other: 20 };
  const second = { value: 10, other: 20 };

  assert.equal(
    sameLocation(
      propertyLocation(first, "value"),
      propertyLocation(first, "value"),
    ),
    true,
  );
  assert.equal(
    sameLocation(
      propertyLocation(first, "value"),
      propertyLocation(second, "value"),
    ),
    false,
  );
  assert.equal(
    sameLocation(
      propertyLocation(first, "value"),
      propertyLocation(first, "other"),
    ),
    false,
  );
});

test("nested property locations follow replacement of their parent storage", () => {
  const original = { value: 1 };
  const parent = location(original);
  const nested = nestedPropertyLocation(parent, "value");

  parent.value = { value: 2 };
  nested.value = 3;

  assert.equal(parent.value.value, 3);
  assert.equal(original.value, 1);
  assert.equal(
    sameLocation(nested, nestedPropertyLocation(parent, "value")),
    true,
  );
});

test("nested element locations follow replacement of their parent storage", () => {
  const original = [1];
  const parent = location(original);
  const nested = nestedPropertyLocation(parent, 0);

  parent.value = [2];
  nested.value = 3;

  assert.deepEqual(parent.value, [3]);
  assert.deepEqual(original, [1]);
  assert.equal(
    sameLocation(nested, nestedPropertyLocation(parent, 0)),
    true,
  );
});

test("nil and allocated locations retain distinct identities", () => {
  const first = location(10);
  const second = location(10);

  assert.equal(sameLocation(first, first), true);
  assert.equal(sameLocation(first, second), false);
  assert.equal(sameLocation(first, undefined), false);
  assert.equal(sameLocation(undefined, undefined), true);
});

test("projected locations preserve identity and bidirectional mutation", () => {
  const source = location(12);
  const projected = projectLocation(
    source,
    (value) => `value:${value}`,
    (value) => Number(value.slice("value:".length)),
  );

  assert.ok(projected !== undefined);
  assert.equal(projected.value, "value:12");
  projected.value = "value:19";
  assert.equal(source.value, 19);
  assert.equal(sameLocation(source, projected), true);
  assert.equal(hashLocation(source), hashLocation(projected));
  assert.equal(projectLocation(undefined, String, Number), undefined);
});

test("location hashing follows exact equality identity", () => {
  const object = { first: 1, second: 2 };
  const first = propertyLocation(object, "first");
  const same = propertyLocation(object, "first");
  const second = propertyLocation(object, "second");

  assert.equal(hashLocation(undefined), 0);
  assert.equal(hashLocation(first), hashLocation(same));
  assert.notEqual(hashLocation(first), hashLocation(second));

  const numericRecord: Record<PropertyKey, number> = { "1": 5 };
  const numeric = propertyLocation(numericRecord, 1);
  const textual = propertyLocation(numericRecord, "1");
  assert.equal(sameLocation(numeric, textual), true);
  assert.equal(hashLocation(numeric), hashLocation(textual));
});

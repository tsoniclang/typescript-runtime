import assert from "node:assert/strict";
import test from "node:test";

import {
  boundLocation,
  hashLocation,
  type Location,
  location,
  nestedPropertyLocation,
  projectLocation,
  propertyLocation,
  sameLocation,
} from "./location.js";

test("bound locations preserve external storage identity and mutation", () => {
  const firstStorage = { value: 10 };
  const secondStorage = { value: 10 };
  const first = boundLocation(
    firstStorage,
    () => firstStorage.value,
    (value) => {
      firstStorage.value = value;
    },
  );
  const alias = boundLocation(
    firstStorage,
    () => firstStorage.value,
    (value) => {
      firstStorage.value = value;
    },
  );
  const second = boundLocation(
    secondStorage,
    () => secondStorage.value,
    (value) => {
      secondStorage.value = value;
    },
  );

  alias.value = 25;

  assert.equal(first.value, 25);
  assert.equal(firstStorage.value, 25);
  assert.equal(sameLocation(first, alias), true);
  assert.equal(hashLocation(first), hashLocation(alias));
  assert.equal(sameLocation(first, second), false);
  assert.notEqual(hashLocation(first), hashLocation(second));
});

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

test("nested locations fail deterministically when live parent storage becomes nullish", () => {
  const parent = location<number[] | null>([1]);
  const nested = nestedPropertyLocation(parent, 0);

  parent.value = null;

  assert.throws(
    () => nested.value,
    /cannot access a property through a nullish location/u,
  );
  assert.throws(
    () => {
      nested.value = 2;
    },
    /cannot access a property through a nullish location/u,
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

test("location hashes preserve nil, alias, and property identity", () => {
  const record = { value: 10, other: 20 };
  const first = propertyLocation(record, "value");
  const alias = propertyLocation(record, "value");
  const other = propertyLocation(record, "other");

  assert.equal(hashLocation(undefined), 0);
  assert.equal(hashLocation(first), hashLocation(alias));
  assert.notEqual(hashLocation(first), hashLocation(other));
  assert.equal(hashLocation(first), hashLocation(first));
});

test("projected locations preserve storage identity and bidirectional mutation", () => {
  const source = location(10);
  const projected = projectLocation(
    source,
    (value) => String(value),
    (value) => Number(value),
  );
  const exactProjected: Location<string> = projected;

  assert.equal(exactProjected.value, "10");
  assert.equal(hashLocation(projected), hashLocation(source));

  projected.value = "25";
  assert.equal(source.value, 25);
  source.value = 30;
  assert.equal(projected.value, "30");
  assert.equal(projectLocation(undefined, String, Number), undefined);
});

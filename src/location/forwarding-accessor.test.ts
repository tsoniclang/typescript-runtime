import assert from "node:assert/strict";
import test from "node:test";
import { location, propertyLocation, sameLocation } from "../location.js";

test("forwarding accessor values do not establish pointer identity", () => {
  const original = location(3);
  const first = {
    get value(): number { return original.value; },
    set value(next: number) { original.value = next; },
  };
  const second = {
    get value(): number { return original.value; },
    set value(next: number) { original.value = next; },
  };
  const firstAddress = propertyLocation(first, "value");
  const secondAddress = propertyLocation(second, "value");
  firstAddress.value = 8;
  assert.equal(original.value, 8);
  assert.equal(secondAddress.value, 8);
  assert.equal(sameLocation(firstAddress, original), false);
  assert.equal(sameLocation(firstAddress, secondAddress), false);
  assert.equal(sameLocation(firstAddress, propertyLocation(first, "value")), true);
});

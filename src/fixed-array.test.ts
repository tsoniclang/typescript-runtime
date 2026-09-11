import assert from "node:assert/strict";
import test from "node:test";
import type { FixedArray } from "./fixed-array.js";

test("fixed-array typing retains existing indexed backing and exact extent", () => {
  const storage: [number, number] = [1, 2];
  const view: FixedArray<number, 2> = storage;
  const length: 2 = view.length;
  view[1] = 9;
  assert.equal(length, 2);
  assert.equal(storage[1], 9);
  assert.equal(view, storage);
  assert.deepEqual([...view], [1, 9]);
});

test("nested fixed-array annotations preserve independent value copies and retained aliases", () => {
  const first: [number, number] = [1, 2];
  const second: [number, number] = [3, 4];
  const backing: [FixedArray<number, 2>, FixedArray<number, 2>] = [first, second];
  const matrix: FixedArray<FixedArray<number, 2>, 2> = backing;
  const alias = matrix[0]!;
  const copy = Array.from(alias);
  alias[0] = 9;
  assert.equal(first[0], 9);
  assert.equal(copy[0], 1);
  assert.equal(second[0], 3);
  assert.equal(matrix, backing);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { keepAlive } from "./lifetime.js";

test("keepAlive accepts every value without changing it or executing members", () => {
  for (const value of [undefined, null, false, 0, 1n, "text", Symbol.for("registered")]) {
    assert.equal(keepAlive(value), undefined);
  }
  assert.equal(keepAlive({ get value() { throw new Error("must not inspect members"); } }), undefined);
});

for (const mode of ["keep", "omit"] as const) {
  test(`job-local reachability has a non-vacuous ${mode} barrier proof`, () => {
    const run = spawnSync(process.execPath, ["--expose-gc", new URL("./testing/lifetime-proof.js", import.meta.url).pathname, mode],
      { encoding: "utf8", timeout: 10000, maxBuffer: 16384 });
    assert.equal(run.error, undefined);
    assert.equal(run.signal, null);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(run.stdout.trim(), `${mode}:retained=${mode === "keep"}:released=true`);
  });
}

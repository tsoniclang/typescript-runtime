import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const outputDirectory = dirname(fileURLToPath(import.meta.url));

test("published declarations expose one closed location and raw-pointer contract", async () => {
  const declarations = await readFile(
    join(outputDirectory, "location.d.ts"),
    "utf8",
  );
  const rawDeclarations = await readFile(
    join(outputDirectory, "raw-pointer.d.ts"),
    "utf8",
  );

  assert.match(
    declarations,
    /export interface Location<T> \{[\s\S]*readonly storageIdentity: object;[\s\S]*readonly storageKey: PropertyKey \| undefined;[\s\S]*value: T;/u,
  );
  assert.match(
    declarations,
    /export declare function boundLocation<T>\(identity: object, read: \(\) => T, write: \(value: T\) => void\): Location<T>;/u,
  );
  assert.match(
    rawDeclarations,
    /declare const rawPointerBrand: unique symbol;/u,
  );
  assert.match(
    rawDeclarations,
    /export interface RawPointer \{[\s\S]*readonly \[rawPointerBrand\]: true;/u,
  );
  assert.doesNotMatch(
    rawDeclarations,
    /readonly identity: object/u,
  );
  assert.doesNotMatch(rawDeclarations, /function rawPointer\(/u);
  assert.match(rawDeclarations, /function toRawPointer<T>/u);
  assert.match(rawDeclarations, /function reinterpretRawPointer<T>/u);
  assert.match(rawDeclarations, /function offsetRawPointer\(/u);
  const scalarDeclarations = await readFile(join(outputDirectory, "memory/scalars.d.ts"), "utf8");
  assert.match(scalarDeclarations, /function booleanLayout\(order: ByteOrder, byteAlignment: number, stride: number\): MemoryLayout<boolean>/u);
  assert.match(scalarDeclarations, /function float32Layout\(order: ByteOrder, byteAlignment: number, stride: number\): MemoryLayout<number>/u);
  assert.match(scalarDeclarations, /function float64Layout\(order: ByteOrder, byteAlignment: number, stride: number\): MemoryLayout<number>/u);
  assert.doesNotMatch(scalarDeclarations, /\b(?:any|unknown)\b/u);
  assert.doesNotMatch(
    `${declarations}\n${rawDeclarations}`,
    /\b(?:any|unknown)\b/u,
  );
});

test("published JavaScript uses closed accessors without reflection or dynamic dispatch", async () => {
  const implementation = await readFile(
    join(outputDirectory, "location.js"),
    "utf8",
  );
  const rawImplementation = await readFile(
    join(outputDirectory, "raw-pointer.js"),
    "utf8",
  );

  assert.match(implementation, /class BoundLocation/u);
  assert.match(implementation, /get value\(\)/u);
  assert.match(implementation, /set value\(value\)/u);
  assert.doesNotMatch(
    `${implementation}\n${rawImplementation}`,
    /\b(?:Reflect|Proxy|eval|Function)\b|\brequire\s*\(/u,
  );
});

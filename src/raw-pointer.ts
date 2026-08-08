import { hashObjectIdentity } from "./object-identity.js";

export interface RawPointer {
  readonly [rawPointerBrand]: true;
}

const rawPointerBrand: unique symbol = Symbol("TsonicRawPointer");
const rawPointers = new WeakMap<object, RawPointer>();
const rawPointerIdentities = new WeakMap<RawPointer, object>();

export function rawPointer(identity: object): RawPointer {
  const existing = rawPointers.get(identity);
  if (existing !== undefined) {
    return existing;
  }
  const pointer = Object.freeze<RawPointer>({ [rawPointerBrand]: true });
  rawPointers.set(identity, pointer);
  rawPointerIdentities.set(pointer, identity);
  return pointer;
}

export function sameRawPointer(
  left: RawPointer | undefined,
  right: RawPointer | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return rawPointerIdentity(left) === rawPointerIdentity(right);
}

export function hashRawPointer(pointer: RawPointer | undefined): number {
  return pointer === undefined ? 0 : hashObjectIdentity(rawPointerIdentity(pointer));
}

function rawPointerIdentity(pointer: RawPointer): object {
  const identity = rawPointerIdentities.get(pointer);
  if (identity === undefined) {
    throw new TypeError("RawPointer was not created by rawPointer(...).");
  }
  return identity;
}

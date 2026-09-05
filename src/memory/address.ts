import type { RawPointer } from "../raw-pointer.js";
import type { MemoryStorage } from "./storage.js";

export interface MemoryAddress {
  readonly storage: MemoryStorage;
  readonly byteOffset: number;
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;
}

const offsets = new WeakMap<object, Map<PropertyKey | undefined, Map<number, object>>>();
const locationAddresses = new WeakMap<object, RawPointer>();

export function memoryAddress(storage: MemoryStorage, byteOffset: number): MemoryAddress {
  if (!Number.isSafeInteger(byteOffset) || byteOffset < 0 || byteOffset > storage.byteLength) {
    throw new RangeError("Raw pointer offset is outside its retained storage.");
  }
  if (byteOffset === 0) {
    return { storage, byteOffset, storageIdentity: storage.storageIdentity, storageKey: storage.storageKey };
  }
  let fields = offsets.get(storage.storageIdentity);
  if (fields === undefined) {
    fields = new Map();
    offsets.set(storage.storageIdentity, fields);
  }
  let positions = fields.get(storage.storageKey);
  if (positions === undefined) {
    positions = new Map();
    fields.set(storage.storageKey, positions);
  }
  let identity = positions.get(byteOffset);
  if (identity === undefined) {
    identity = {};
    positions.set(byteOffset, identity);
  }
  return { storage, byteOffset, storageIdentity: identity, storageKey: undefined };
}

export function retainedMemoryAddress(location: object): RawPointer | undefined {
  return locationAddresses.get(location);
}

export function retainMemoryAddress(location: object, pointer: RawPointer): void {
  locationAddresses.set(location, pointer);
}

export function inheritMemoryAddress(source: object, target: object): void {
  const pointer = retainedMemoryAddress(source);
  if (pointer !== undefined) retainMemoryAddress(target, pointer);
}

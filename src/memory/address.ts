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
  const position = storage.position(byteOffset);
  if (position.displacement === 0) {
    return { storage, byteOffset, storageIdentity: position.identity, storageKey: position.key };
  }
  let fields = offsets.get(position.identity);
  if (fields === undefined) {
    fields = new Map();
    offsets.set(position.identity, fields);
  }
  let positions = fields.get(position.key);
  if (positions === undefined) {
    positions = new Map();
    fields.set(position.key, positions);
  }
  let identity = positions.get(position.displacement);
  if (identity === undefined) {
    identity = {};
    positions.set(position.displacement, identity);
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

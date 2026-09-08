import type { MemoryPosition, MemoryStorage } from "./storage.js";

export interface MemoryAddress {
  readonly storage: MemoryStorage;
  readonly byteOffset: number;
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;
}

const offsets = new WeakMap<object, Map<PropertyKey | undefined, Map<number, object>>>();
const locationAddresses = new WeakMap<object, MemoryAddress>();

export function memoryAddress(storage: MemoryStorage, byteOffset: number): MemoryAddress {
  if (!Number.isSafeInteger(byteOffset) || byteOffset < 0 || byteOffset > storage.byteLength) {
    throw new RangeError("Raw pointer offset is outside its retained storage.");
  }
  const position = storage.position(byteOffset);
  const identity = memoryPositionIdentity(position);
  return Object.freeze({ storage, byteOffset, storageIdentity: identity.identity, storageKey: identity.key });
}

export function memoryPositionIdentity(position: MemoryPosition): Pick<MemoryPosition, "identity" | "key"> {
  if (position.displacement === 0) {
    return { identity: position.identity, key: position.key };
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
  return { identity, key: undefined };
}

export function retainedMemoryAddress(location: object): MemoryAddress | undefined {
  return locationAddresses.get(location);
}

export function retainMemoryAddress(location: object, address: MemoryAddress): void {
  const previous = locationAddresses.get(location);
  if (previous !== undefined && (previous.storage !== address.storage || previous.byteOffset !== address.byteOffset)) {
    throw new TypeError("A location cannot change its retained memory allocation.");
  }
  locationAddresses.set(location, address);
}

export function inheritMemoryAddress(source: object, target: object): void {
  const pointer = retainedMemoryAddress(source);
  if (pointer !== undefined) retainMemoryAddress(target, pointer);
}

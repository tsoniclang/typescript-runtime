import type { MemoryPosition, MemoryStorage } from "./storage.js";
import type { Location } from "../location.js";

export interface MemoryAddress {
  readonly storage: MemoryStorage;
  readonly byteOffset: number;
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;
}

const offsets = new WeakMap<object, Map<PropertyKey | undefined, Map<number, object>>>();
export type LocationIdentity = Pick<Location<never>, "storageIdentity" | "storageKey">;
export interface MemoryAssociation {
  readonly location: LocationIdentity;
  readonly address: MemoryAddress;
}
const locationAddresses = new WeakMap<object, MemoryAddress>();
const boundAddresses = new WeakMap<object, Map<PropertyKey | undefined, MemoryAddress | undefined>>();

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

export function retainedMemoryAddress(location: LocationIdentity): MemoryAddress | undefined {
  return boundAddresses.get(location.storageIdentity)?.get(location.storageKey) ?? locationAddresses.get(location);
}

export function retainMemoryAddress(location: LocationIdentity, address: MemoryAddress): void {
  const previous = retainedMemoryAddress(location);
  if (previous !== undefined && (previous.storage !== address.storage || previous.byteOffset !== address.byteOffset)) {
    throw new TypeError("A location cannot change its retained memory allocation.");
  }
  locationAddresses.set(location, address);
  const members = boundAddresses.get(location.storageIdentity);
  if (members?.has(location.storageKey)) members.set(location.storageKey, address);
}

export function isBoundLocation(location: LocationIdentity): boolean {
  return boundAddresses.get(location.storageIdentity)?.has(location.storageKey) === true;
}

export function retainBoundLocations(locations: readonly LocationIdentity[]): void {
  const known = locations.flatMap(location => {
    const address = retainedMemoryAddress(location);
    return address === undefined ? [] : [{ location, address }];
  });
  validateMemoryAssociations(known);
  for (const location of locations) {
    let members = boundAddresses.get(location.storageIdentity);
    if (members === undefined) {
      members = new Map();
      boundAddresses.set(location.storageIdentity, members);
    }
    if (!members.has(location.storageKey)) members.set(location.storageKey, undefined);
  }
  for (const { location, address } of known) retainMemoryAddress(location, address);
}

export function retainMemoryAssociations(associations: readonly MemoryAssociation[]): void {
  validateMemoryAssociations(associations);
  for (const { location, address } of associations) retainMemoryAddress(location, address);
}

function validateMemoryAssociations(associations: readonly MemoryAssociation[]): void {
  const pending = new Map<object, Map<PropertyKey | undefined, MemoryAddress>>();
  for (const { location, address } of associations) {
    const previous = pending.get(location.storageIdentity)?.get(location.storageKey) ?? retainedMemoryAddress(location);
    if (previous !== undefined && (previous.storage !== address.storage || previous.byteOffset !== address.byteOffset)) {
      throw new TypeError("Bound record fields have conflicting retained memory provenance.");
    }
    let members = pending.get(location.storageIdentity);
    if (members === undefined) {
      members = new Map();
      pending.set(location.storageIdentity, members);
    }
    members.set(location.storageKey, address);
  }
}

export function inheritMemoryAddress(source: LocationIdentity, target: LocationIdentity): void {
  const pointer = retainedMemoryAddress(source);
  if (pointer !== undefined) retainMemoryAddress(target, pointer);
}

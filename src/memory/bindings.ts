import type { Location } from "../location.js";
import { retainedMemoryAddress, retainBoundLocations } from "./address.js";
import type { LocationIdentity } from "./address.js";
import { retainPropertyIdentity } from "../location/property-identity.js";
import type { PropertyIdentity } from "../location/property-identity.js";

export type MemoryFieldBinding<T> = { readonly [Key in keyof T]?: Location<T[Key]> };

export interface BoundRecord<T extends object> {
  readonly value: T;
  readonly identity: (key: PropertyKey) => PropertyIdentity | undefined;
  readonly locations: readonly LocationIdentity[];
}

export function requireBoundField<T>(pointer: Location<T> | undefined): Location<T> {
  if (pointer === undefined) throw new TypeError("A bound record is missing its selected field location.");
  return pointer;
}

export function boundFieldIdentity<T>(pointer: Location<T>): PropertyIdentity {
  const address = retainedMemoryAddress(pointer);
  return address === undefined
    ? { identity: pointer.storageIdentity, key: pointer.storageKey }
    : { identity: pointer.storageIdentity, key: pointer.storageKey, address };
}

export function bindMemoryRecord<Fields, Record extends object>(
  fields: Fields,
  create: (fields: Fields) => BoundRecord<Record>,
): Record {
  const record = create(fields);
  retainBoundLocations(record.locations);
  retainPropertyIdentity(record.value, record.identity);
  return record.value;
}

import type { MemoryAddress } from "../memory/address.js";

export interface PropertyIdentity {
  readonly identity: object;
  readonly key: PropertyKey | undefined;
  readonly address?: MemoryAddress;
}

const views = new WeakMap<object, (key: PropertyKey) => PropertyIdentity | undefined>();

export function retainPropertyIdentity(view: object, resolve: (key: PropertyKey) => PropertyIdentity | undefined): void {
  if (views.has(view)) throw new TypeError("A property view cannot change its storage identity.");
  views.set(view, resolve);
}

export function propertyIdentity(value: object, key: PropertyKey): PropertyIdentity {
  return retainedPropertyIdentity(value, key) ?? { identity: value, key };
}

export function retainedPropertyIdentity(value: object, key: PropertyKey): PropertyIdentity | undefined {
  return views.get(value)?.(key);
}

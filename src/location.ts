import { hashObjectIdentity } from "./object-identity.js";

export interface Location<T> {
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;
  value: T;
}

export function location<T>(initial: T): Location<T> {
  return {
    storageIdentity: {},
    storageKey: undefined,
    value: initial,
  };
}

export function boundLocation<T>(
  identity: object,
  read: () => T,
  write: (value: T) => void,
): Location<T> {
  return {
    storageIdentity: identity,
    storageKey: undefined,
    get value() {
      return read();
    },
    set value(value: T) {
      write(value);
    },
  };
}

export function propertyLocation<
  TObject extends object,
  TKey extends keyof TObject,
>(object: TObject, key: TKey): Location<TObject[TKey]> {
  return {
    storageIdentity: object,
    storageKey: key,
    get value() {
      return object[key];
    },
    set value(value: TObject[TKey]) {
      object[key] = value;
    },
  };
}

const childStorageIdentities = new WeakMap<
  object,
  Map<PropertyKey, object>
>();

export function nestedPropertyLocation<
  TObject extends object,
  TKey extends keyof TObject,
>(parent: Location<TObject>, key: TKey): Location<TObject[TKey]> {
  return {
    storageIdentity: locationIdentity(parent),
    storageKey: key,
    get value() {
      return parent.value[key];
    },
    set value(value: TObject[TKey]) {
      parent.value[key] = value;
    },
  };
}

function locationIdentity(location: Location<unknown>): object {
  if (location.storageKey === undefined) {
    return location.storageIdentity;
  }
  let children = childStorageIdentities.get(location.storageIdentity);
  if (children === undefined) {
    children = new Map<PropertyKey, object>();
    childStorageIdentities.set(location.storageIdentity, children);
  }
  let identity = children.get(location.storageKey);
  if (identity === undefined) {
    identity = {};
    children.set(location.storageKey, identity);
  }
  return identity;
}

export function sameLocation<T>(
  left: Location<T> | undefined,
  right: Location<T> | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left === right ||
    left.storageIdentity === right.storageIdentity &&
    left.storageKey === right.storageKey;
}

export function hashLocation(
  pointer: Location<unknown> | undefined,
): number {
  if (pointer === undefined) {
    return 0;
  }
  const identity = locationIdentity(pointer);
  return hashObjectIdentity(identity);
}

export function projectLocation<TSource, TTarget>(
  pointer: Location<TSource> | undefined,
  fromSource: (value: TSource) => TTarget,
  toSource: (value: TTarget) => TSource,
): Location<TTarget> | undefined {
  if (pointer === undefined) {
    return undefined;
  }
  return {
    storageIdentity: pointer.storageIdentity,
    storageKey: pointer.storageKey,
    get value() {
      return fromSource(pointer.value);
    },
    set value(value: TTarget) {
      pointer.value = toSource(value);
    },
  };
}

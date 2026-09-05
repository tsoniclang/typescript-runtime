import { hashObjectIdentity } from "./object-identity.js";
import { inheritMemoryAddress } from "./memory/address.js";

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
  return new BoundLocation(identity, read, write);
}

class BoundLocation<T> implements Location<T> {
  readonly storageKey = undefined;

  constructor(
    readonly storageIdentity: object,
    private readonly read: () => T,
    private readonly write: (value: T) => void,
  ) {}

  get value(): T {
    return this.read();
  }

  set value(value: T) {
    this.write(value);
  }
}

export function propertyLocation<
  TObject extends object,
  TKey extends keyof TObject,
>(object: TObject, key: TKey): Location<TObject[TKey]> {
  return new PropertyLocation(object, key);
}

class PropertyLocation<
  TObject extends object,
  TKey extends keyof TObject,
> implements Location<TObject[TKey]> {
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey;

  constructor(
    private readonly object: TObject,
    private readonly key: TKey,
  ) {
    this.storageIdentity = object;
    this.storageKey = key;
  }

  get value(): TObject[TKey] {
    return this.object[this.key];
  }

  set value(value: TObject[TKey]) {
    this.object[this.key] = value;
  }
}

const childStorageIdentities = new WeakMap<
  object,
  Map<PropertyKey, object>
>();

export function nestedPropertyLocation<
  TObject extends object,
  TKey extends keyof TObject,
>(
  parent: Location<TObject | null | undefined>,
  key: TKey,
): Location<TObject[TKey]> {
  return new NestedPropertyLocation(parent, key);
}

class NestedPropertyLocation<
  TObject extends object,
  TKey extends keyof TObject,
> implements Location<TObject[TKey]> {
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey;

  constructor(
    private readonly parent: Location<TObject | null | undefined>,
    private readonly key: TKey,
  ) {
    this.storageIdentity = locationIdentity(parent);
    this.storageKey = key;
  }

  get value(): TObject[TKey] {
    return this.object()[this.key];
  }

  set value(value: TObject[TKey]) {
    this.object()[this.key] = value;
  }

  private object(): TObject {
    const object = this.parent.value;
    if (object === null || object === undefined) {
      throw new TypeError("cannot access a property through a nullish location");
    }
    return object;
  }
}

function locationIdentity<T>(location: Location<T>): object {
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

export function hashLocation<T>(
  pointer: Location<T> | undefined,
): number {
  if (pointer === undefined) {
    return 0;
  }
  const identity = locationIdentity(pointer);
  return hashObjectIdentity(identity);
}

export function projectLocation<TSource, TTarget>(
  pointer: Location<TSource>,
  fromSource: (value: TSource) => TTarget,
  toSource: (value: TTarget) => TSource,
): Location<TTarget>;
export function projectLocation<TSource, TTarget>(
  pointer: Location<TSource> | undefined,
  fromSource: (value: TSource) => TTarget,
  toSource: (value: TTarget) => TSource,
): Location<TTarget> | undefined;
export function projectLocation<TSource, TTarget>(
  pointer: Location<TSource> | undefined,
  fromSource: (value: TSource) => TTarget,
  toSource: (value: TTarget) => TSource,
): Location<TTarget> | undefined {
  if (pointer === undefined) {
    return undefined;
  }
  const projected = new ProjectedLocation(pointer, fromSource, toSource);
  inheritMemoryAddress(pointer, projected);
  return projected;
}

class ProjectedLocation<TSource, TTarget> implements Location<TTarget> {
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;

  constructor(
    private readonly pointer: Location<TSource>,
    private readonly fromSource: (value: TSource) => TTarget,
    private readonly toSource: (value: TTarget) => TSource,
  ) {
    this.storageIdentity = pointer.storageIdentity;
    this.storageKey = pointer.storageKey;
  }

  get value(): TTarget {
    return this.fromSource(this.pointer.value);
  }

  set value(value: TTarget) {
    this.pointer.value = this.toSource(value);
  }
}

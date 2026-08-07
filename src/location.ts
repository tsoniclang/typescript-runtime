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

export function propertyLocation<
  TObject extends object,
  TKey extends keyof TObject,
>(object: TObject, key: TKey): Location<TObject[TKey]> {
  return {
    storageIdentity: object,
    storageKey: canonicalPropertyKey(key),
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
    storageKey: canonicalPropertyKey(key),
    get value() {
      return parent.value[key];
    },
    set value(value: TObject[TKey]) {
      parent.value[key] = value;
    },
  };
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

export function projectLocation<F, T>(
  source: Location<F> | undefined,
  fromSource: (value: F) => T,
  toSource: (value: T) => F,
): Location<T> | undefined {
  if (source === undefined) {
    return undefined;
  }
  return {
    storageIdentity: source.storageIdentity,
    storageKey: source.storageKey,
    get value() {
      return fromSource(source.value);
    },
    set value(value: T) {
      source.value = toSource(value);
    },
  };
}

const locationHashes = new WeakMap<object, number>();
const symbolHashes = new Map<symbol, number>();
let nextLocationHash = 1;
let nextSymbolHash = 1;

export function hashLocation<T>(location: Location<T> | undefined): number {
  if (location === undefined) {
    return 0;
  }
  const identity = identityHash(location.storageIdentity);
  const key = location.storageKey === undefined
    ? 0
    : keyHash(location.storageKey);
  return (Math.imul(identity, 16_777_619) ^ key) >>> 0;
}

function identityHash(identity: object): number {
  const existing = locationHashes.get(identity);
  if (existing !== undefined) {
    return existing;
  }
  const hash = nextLocationHash;
  nextLocationHash += 1;
  locationHashes.set(identity, hash);
  return hash;
}

function keyHash(key: PropertyKey): number {
  if (typeof key === "symbol") {
    const existing = symbolHashes.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const hash = nextSymbolHash;
    nextSymbolHash += 1;
    symbolHashes.set(key, hash);
    return hash;
  }
  let hash = 2_166_136_261;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619);
  }
  return hash >>> 0;
}

function canonicalPropertyKey(key: PropertyKey): string | symbol {
  return typeof key === "symbol" ? key : String(key);
}

export function sameLocation<L, R>(
  left: Location<L> | undefined,
  right: Location<R> | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.storageIdentity === right.storageIdentity &&
    left.storageKey === right.storageKey;
}

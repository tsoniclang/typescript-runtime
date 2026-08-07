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
    storageKey: key,
    get value() {
      return object[key];
    },
    set value(value: TObject[TKey]) {
      object[key] = value;
    },
  };
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

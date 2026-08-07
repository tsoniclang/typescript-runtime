export interface Location<T> {
  value: T;
}

export function location<T>(initial: T): Location<T> {
  return { value: initial };
}

export function propertyLocation<
  TObject extends object,
  TKey extends keyof TObject,
>(object: TObject, key: TKey): Location<TObject[TKey]> {
  return {
    get value() {
      return object[key];
    },
    set value(value: TObject[TKey]) {
      object[key] = value;
    },
  };
}

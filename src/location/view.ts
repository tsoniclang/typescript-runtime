import type { Location } from "../location.js";
import { inheritMemoryAddress } from "../memory/address.js";
import { retainLocationProjection } from "./projection.js";

export function viewLocation<TSource, TTarget>(
  pointer: Location<TSource>,
  read: () => TTarget,
  write: (value: TTarget) => void,
): Location<TTarget>;
export function viewLocation<TSource, TTarget>(
  pointer: Location<TSource> | undefined,
  read: () => TTarget,
  write: (value: TTarget) => void,
): Location<TTarget> | undefined;
export function viewLocation<TSource, TTarget>(
  pointer: Location<TSource> | undefined,
  read: () => TTarget,
  write: (value: TTarget) => void,
): Location<TTarget> | undefined {
  if (pointer === undefined) return undefined;
  const view = new LocationView(pointer, read, write);
  retainLocationProjection(view);
  inheritMemoryAddress(pointer, view);
  return view;
}

class LocationView<T> implements Location<T> {
  private readonly base: Pick<Location<T>, "storageIdentity" | "storageKey">;
  private readonly read: () => T;
  private readonly write: (value: T) => void;

  constructor(
    base: Pick<Location<T>, "storageIdentity" | "storageKey">,
    read: () => T,
    write: (value: T) => void,
  ) {
    this.base = base;
    this.read = read;
    this.write = write;
  }

  get storageIdentity(): object { return this.base.storageIdentity; }
  get storageKey(): PropertyKey | undefined { return this.base.storageKey; }
  get value(): T { return this.read(); }
  set value(value: T) { this.write(value); }
}

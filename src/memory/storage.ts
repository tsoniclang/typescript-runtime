import type { Location } from "../location.js";
import { hasLocationProjection } from "../location/projection.js";
import type { MemoryLayout, MemoryShape } from "./layout.js";
import { assignMemoryValue, refreshMemoryValue, sameMemoryLayout } from "./layout.js";
import { readMemoryBytes, writeMemoryBytes } from "./bytes.js";
import { retainMemoryAssociations } from "./address.js";

export interface MemoryStorage {
  readonly byteLength: number;
  readonly byteAlignment: number;
  position(byteOffset: number): MemoryPosition;
  typedPosition(byteOffset: number, layout: MemoryShape): MemoryPosition;
  read(byteOffset: number, byteLength: number): Uint8Array;
  write(byteOffset: number, bytes: Uint8Array): void;
}

export interface MemoryPosition {
  readonly identity: object;
  readonly key: PropertyKey | undefined;
  readonly displacement: number;
}

export function validateMemoryRange(storage: MemoryStorage, byteOffset: number, byteLength: number): void {
  if (!Number.isSafeInteger(byteOffset) || !Number.isSafeInteger(byteLength) ||
      byteOffset < 0 || byteLength < 0 || byteOffset > storage.byteLength - byteLength) {
    throw new RangeError("Memory access exceeds the retained allocation.");
  }
}

interface RetainedAllocation {
  readonly storage: MemoryStorage;
  accepts<T>(layout: MemoryLayout<T>): boolean;
}

const allocations = new WeakMap<object, Map<PropertyKey | undefined, RetainedAllocation>>();

export function locationMemory<T>(pointer: Location<T>, layout: MemoryLayout<T>): MemoryStorage {
  let members = allocations.get(pointer.storageIdentity);
  if (members === undefined) {
    members = new Map();
    allocations.set(pointer.storageIdentity, members);
  }
  const previous = members.get(pointer.storageKey);
  if (previous !== undefined) {
    if (!previous.accepts(layout)) throw new TypeError("Location memory cannot change its selected layout.");
    return previous.storage;
  }
  const storage = new LocationMemory(pointer, layout);
  members.set(pointer.storageKey, {
    storage,
    accepts: <Value>(selected: MemoryLayout<Value>): boolean => sameMemoryLayout(layout, selected),
  });
  return storage;
}

export class LocationMemory<T> implements MemoryStorage {
  readonly byteLength: number;
  readonly byteAlignment: number;
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;

  private readonly pointer: Location<T>;
  private readonly layout: MemoryLayout<T>;
  private readonly projectedPosition: ((byteOffset: number, layout?: MemoryShape) => MemoryPosition | undefined) | undefined;
  private bytes: Uint8Array | undefined;

  constructor(pointer: Location<T>, layout: MemoryLayout<T>) {
    this.pointer = pointer;
    this.layout = layout;
    this.byteLength = layout.byteSize;
    this.byteAlignment = layout.byteAlignment;
    this.storageIdentity = pointer.storageIdentity;
    this.storageKey = pointer.storageKey;
    const record = layout.record;
    if (record !== undefined) {
      const origin = pointer.value;
      if (hasLocationProjection(pointer)) {
        this.projectedPosition = (offset, selected) => record.position(origin, offset, selected);
      }
      retainMemoryAssociations(record.locations(origin, this, 0));
    }
  }

  position(byteOffset: number): MemoryPosition {
    validateMemoryRange(this, byteOffset, 0);
    if (byteOffset === this.byteLength) {
      return { identity: this.storageIdentity, key: this.storageKey, displacement: byteOffset };
    }
    if (this.projectedPosition !== undefined) {
      return this.projectedPosition(byteOffset) ??
        { identity: this.storageIdentity, key: this.storageKey, displacement: byteOffset };
    }
    return this.layout.record?.position(this.pointer.value, byteOffset) ??
      { identity: this.storageIdentity, key: this.storageKey, displacement: byteOffset };
  }

  typedPosition(byteOffset: number, layout: MemoryShape): MemoryPosition {
    validateMemoryRange(this, byteOffset, layout.byteSize);
    if (byteOffset === this.byteLength) return this.position(byteOffset);
    if (byteOffset === 0 && sameMemoryLayout(this.layout, layout)) {
      return { identity: this.storageIdentity, key: this.storageKey, displacement: 0 };
    }
    if (this.projectedPosition !== undefined) return this.projectedPosition(byteOffset, layout) ?? this.position(byteOffset);
    return this.layout.record?.position(this.pointer.value, byteOffset, layout) ?? this.position(byteOffset);
  }

  read(byteOffset: number, byteLength: number): Uint8Array {
    validateMemoryRange(this, byteOffset, byteLength);
    const view = this.byteView();
    refreshMemoryValue(this.layout, view, this.pointer.value, byteOffset, byteLength);
    return readMemoryBytes(view, byteOffset, byteLength);
  }

  write(byteOffset: number, bytes: Uint8Array): void {
    validateMemoryRange(this, byteOffset, bytes.byteLength);
    const view = this.byteView();
    const previous = this.pointer.value;
    refreshMemoryValue(this.layout, view, previous, byteOffset, bytes.byteLength);
    writeMemoryBytes(view, byteOffset, bytes);
    const next = assignMemoryValue(this.layout, view, previous, byteOffset, bytes.byteLength);
    this.pointer.value = next;
  }

  private byteView(): DataView {
    this.bytes ??= new Uint8Array(this.byteLength);
    return new DataView(this.bytes.buffer);
  }
}

import type { Location } from "../location.js";
import type { MemoryLayout } from "./layout.js";

export interface MemoryStorage {
  readonly byteLength: number;
  readonly byteAlignment: number;
  position(byteOffset: number): MemoryPosition;
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

export class LocationMemory<T> implements MemoryStorage {
  readonly byteLength: number;
  readonly byteAlignment: number;
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;

  private readonly pointer: Location<T>;
  private readonly layout: MemoryLayout<T>;

  constructor(pointer: Location<T>, layout: MemoryLayout<T>) {
    this.pointer = pointer;
    this.layout = layout;
    this.byteLength = layout.byteSize;
    this.byteAlignment = layout.byteAlignment;
    this.storageIdentity = pointer.storageIdentity;
    this.storageKey = pointer.storageKey;
  }

  position(byteOffset: number): MemoryPosition {
    validateMemoryRange(this, byteOffset, 0);
    return { identity: this.storageIdentity, key: this.storageKey, displacement: byteOffset };
  }

  read(byteOffset: number, byteLength: number): Uint8Array {
    validateMemoryRange(this, byteOffset, byteLength);
    const bytes = new Uint8Array(this.byteLength);
    this.layout.write(new DataView(bytes.buffer), this.pointer.value);
    return bytes.slice(byteOffset, byteOffset + byteLength);
  }

  write(byteOffset: number, bytes: Uint8Array): void {
    validateMemoryRange(this, byteOffset, bytes.byteLength);
    const current = this.read(0, this.byteLength);
    current.set(bytes, byteOffset);
    this.pointer.value = this.layout.read(new DataView(current.buffer));
  }
}

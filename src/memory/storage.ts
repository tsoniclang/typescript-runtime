import type { Location } from "../location.js";
import type { MemoryLayout } from "./layout.js";

export interface MemoryStorage {
  readonly byteLength: number;
  readonly byteAlignment: number;
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;
  read(): Uint8Array;
  write(bytes: Uint8Array): void;
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

  read(): Uint8Array {
    const bytes = new Uint8Array(this.byteLength);
    this.layout.write(new DataView(bytes.buffer), this.pointer.value);
    return bytes;
  }

  write(bytes: Uint8Array): void {
    if (bytes.byteLength !== this.byteLength) {
      throw new RangeError("Memory write must preserve the original storage extent.");
    }
    this.pointer.value = this.layout.read(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  }
}

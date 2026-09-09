import { assignMemoryValue, refreshMemoryValue, sameMemoryLayout, validateMemoryLayout } from "./layout.js";
import type { MemoryLayout, MemoryShape } from "./layout.js";
import { validateMemoryRange } from "./storage.js";
import type { MemoryPosition, MemoryStorage } from "./storage.js";
import { readMemoryBytes, writeMemoryBytes } from "./bytes.js";

interface ArrayAllocation {
  readonly storage: MemoryStorage;
  accepts<T>(layout: MemoryLayout<T>, length: number): boolean;
}

const allocations = new WeakMap<object, ArrayAllocation>();

export function arrayMemory<T>(values: T[], layout: MemoryLayout<T>): MemoryStorage {
  validateMemoryLayout(layout);
  if (layout.stride === 0) throw new RangeError("Array byte addressing requires a positive element stride.");
  const previous = allocations.get(values);
  if (previous !== undefined) {
    if (!previous.accepts(layout, values.length)) {
      throw new TypeError("Array memory cannot change its selected element layout or extent.");
    }
    return previous.storage;
  }
  const storage = new ArrayMemory(values, layout);
  const length = values.length;
  allocations.set(values, {
    storage,
    accepts: <Element>(selected: MemoryLayout<Element>, count: number): boolean =>
      count === length && sameMemoryLayout(layout, selected),
  });
  return storage;
}

class ArrayMemory<T> implements MemoryStorage {
  readonly byteLength: number;
  readonly byteAlignment: number;
  private readonly bytes: Uint8Array;
  private readonly count: number;
  private readonly values: T[];
  private readonly layout: MemoryLayout<T>;

  constructor(values: T[], layout: MemoryLayout<T>) {
    this.values = values;
    this.layout = layout;
    this.count = values.length;
    this.byteLength = this.count * layout.stride;
    this.byteAlignment = layout.byteAlignment;
    if (!Number.isSafeInteger(this.byteLength)) throw new RangeError("Array allocation extent is not an exact integer.");
    this.bytes = new Uint8Array(this.byteLength);
  }

  position(byteOffset: number): MemoryPosition {
    this.validate(byteOffset, 0);
    const index = Math.floor(byteOffset / this.layout.stride);
    const value = this.values[index];
    const displacement = byteOffset % this.layout.stride;
    return value === undefined ? { identity: this.values, key: index, displacement } :
      this.layout.record?.position(value, displacement) ?? { identity: this.values, key: index, displacement };
  }

  typedPosition(byteOffset: number, layout: MemoryShape): MemoryPosition {
    this.validate(byteOffset, layout.byteSize);
    const index = Math.floor(byteOffset / this.layout.stride);
    const displacement = byteOffset % this.layout.stride;
    if (displacement === 0 && sameMemoryLayout(this.layout, layout)) {
      return { identity: this.values, key: index, displacement };
    }
    const value = this.values[index];
    return value === undefined ? this.position(byteOffset) :
      this.layout.record?.position(value, displacement, layout) ?? this.position(byteOffset);
  }

  read(byteOffset: number, byteLength: number): Uint8Array {
    this.validate(byteOffset, byteLength);
    this.synchronize(byteOffset, byteLength);
    return readMemoryBytes(new DataView(this.bytes.buffer), byteOffset, byteLength);
  }

  write(byteOffset: number, bytes: Uint8Array): void {
    this.validate(byteOffset, bytes.byteLength);
    this.synchronize(byteOffset, bytes.byteLength);
    writeMemoryBytes(new DataView(this.bytes.buffer), byteOffset, bytes);
    this.eachValue(byteOffset, bytes.byteLength, (index, view, offset, length) => {
      const previous = this.values[index];
      if (previous === undefined) throw new TypeError("Array memory requires an initialized element.");
      const next = assignMemoryValue(this.layout, view, previous, offset, length);
      if (this.layout.record === undefined) this.values[index] = next;
    });
  }

  private synchronize(byteOffset: number, byteLength: number): void {
    this.eachValue(byteOffset, byteLength, (index, view, offset, length) => {
      const value = this.values[index];
      if (value === undefined) throw new TypeError("Array memory requires an initialized element.");
      refreshMemoryValue(this.layout, view, value, offset, length);
    });
  }

  private eachValue(byteOffset: number, byteLength: number, action: (index: number, view: DataView, byteOffset: number, byteLength: number) => void): void {
    if (byteLength === 0) return;
    const end = byteOffset + byteLength;
    for (let index = Math.floor(byteOffset / this.layout.stride); index < this.count && index * this.layout.stride < end; index++) {
      const start = index * this.layout.stride;
      if (start + this.layout.byteSize > byteOffset) {
        const offset = Math.max(byteOffset - start, 0);
        action(index, new DataView(this.bytes.buffer, start, this.layout.byteSize), offset,
          Math.min(this.layout.byteSize, end - start) - offset);
      }
    }
  }

  private validate(byteOffset: number, byteLength: number): void {
    if (this.values.length !== this.count) throw new RangeError("Array memory cannot resize its retained allocation.");
    validateMemoryRange(this, byteOffset, byteLength);
  }
}

import { hashLocation } from "./location.js";
import type { Location } from "./location.js";
import { memoryAddress, retainMemoryAddress, retainedMemoryAddress } from "./memory/address.js";
import type { MemoryAddress } from "./memory/address.js";
import { validateMemoryLayout } from "./memory/layout.js";
import type { MemoryLayout } from "./memory/layout.js";
import { LocationMemory } from "./memory/storage.js";

export interface RawPointer {
  readonly [rawPointerBrand]: true;
}

const rawPointerBrand: unique symbol = Symbol("TsonicRawPointer");
const addresses = new WeakMap<RawPointer, MemoryAddress>();

function pointerAt(address: MemoryAddress): RawPointer {
  const pointer = Object.freeze<RawPointer>({ [rawPointerBrand]: true });
  addresses.set(pointer, address);
  return pointer;
}

function addressOf(pointer: RawPointer): MemoryAddress {
  const address = addresses.get(pointer);
  if (address === undefined) throw new TypeError("Raw pointer has no retained memory provenance.");
  return address;
}

export function toRawPointer<T>(pointer: Location<T> | undefined, layout: MemoryLayout<T>): RawPointer | undefined {
  validateMemoryLayout(layout);
  if (pointer === undefined) return undefined;
  const retained = retainedMemoryAddress(pointer);
  if (retained !== undefined) {
    validateView(addressOf(retained), layout);
    return retained;
  }
  return pointerAt(memoryAddress(new LocationMemory(pointer, layout), 0));
}

export function reinterpretRawPointer<T>(pointer: RawPointer | undefined, layout: MemoryLayout<T>): Location<T> | undefined {
  validateMemoryLayout(layout);
  if (pointer === undefined) return undefined;
  const address = addressOf(pointer);
  validateView(address, layout);
  const result = new MemoryLocation(address, layout);
  retainMemoryAddress(result, pointer);
  return result;
}

export function offsetRawPointer(pointer: RawPointer | undefined, byteOffset: number | bigint): RawPointer | undefined {
  if (typeof byteOffset === "number" && !Number.isSafeInteger(byteOffset)) {
    throw new RangeError("Raw byte offset must be an exact integer.");
  }
  const delta = BigInt(byteOffset);
  if (pointer === undefined) {
    if (delta === 0n) return undefined;
    throw new RangeError("A nil pointer has no storage to offset.");
  }
  const original = addressOf(pointer);
  const position = BigInt(original.byteOffset) + delta;
  if (position < 0n || position > BigInt(original.storage.byteLength)) {
    throw new RangeError("Raw pointer offset is outside its retained storage.");
  }
  return pointerAt(memoryAddress(original.storage, Number(position)));
}

export function sameRawPointer(
  left: RawPointer | undefined,
  right: RawPointer | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  const first = addressOf(left);
  const second = addressOf(right);
  return first.storageIdentity === second.storageIdentity && first.storageKey === second.storageKey;
}

export function hashRawPointer(pointer: RawPointer | undefined): number {
  if (pointer === undefined) return 0;
  const address = addressOf(pointer);
  return hashLocation({ storageIdentity: address.storageIdentity, storageKey: address.storageKey, value: undefined });
}

function validateView<T>(address: MemoryAddress, layout: MemoryLayout<T>): void {
  if (address.byteOffset + layout.byteSize > address.storage.byteLength ||
      address.storage.byteAlignment % layout.byteAlignment !== 0 ||
      address.byteOffset % layout.byteAlignment !== 0) {
    throw new RangeError("Raw typed view exceeds its storage or violates its selected alignment.");
  }
}

class MemoryLocation<T> implements Location<T> {
  readonly storageIdentity: object;
  readonly storageKey: PropertyKey | undefined;
  private readonly address: MemoryAddress;
  private readonly layout: MemoryLayout<T>;

  constructor(address: MemoryAddress, layout: MemoryLayout<T>) {
    this.address = address;
    this.layout = layout;
    this.storageIdentity = address.storageIdentity;
    this.storageKey = address.storageKey;
  }

  get value(): T {
    const bytes = this.address.storage.read();
    return this.layout.read(new DataView(bytes.buffer, bytes.byteOffset + this.address.byteOffset, this.layout.byteSize));
  }

  set value(value: T) {
    const bytes = this.address.storage.read();
    this.layout.write(new DataView(bytes.buffer, bytes.byteOffset + this.address.byteOffset, this.layout.byteSize), value);
    this.address.storage.write(bytes);
  }
}

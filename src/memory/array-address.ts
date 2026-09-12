import type { FixedArray } from "../fixed-array.js";
import { littleEndian, validateMemoryLayout } from "./layout.js";
import type { ByteOrder, MemoryLayout } from "./layout.js";

export function arrayAddressLayout<Element, Length extends number | bigint>(
  byteOrder: ByteOrder,
  byteSize: number,
  byteAlignment: number,
  stride: number,
  element: MemoryLayout<Element>,
  length: Length,
): MemoryLayout<FixedArray<Element, Length>> {
  littleEndian(byteOrder);
  validateMemoryLayout(element);
  if (typeof length === "number" && !Number.isSafeInteger(length) || length < 0 ||
      byteOrder !== element.byteOrder) {
    throw new RangeError("Array address layout requires an exact non-negative extent and matching element byte order.");
  }
  const count = BigInt(length);
  const minimumSize = count === 0n ? 0n : (count - 1n) * BigInt(element.stride) + BigInt(element.byteSize);
  const layout: MemoryLayout<FixedArray<Element, Length>> = Object.freeze({
    codec: "array-address", byteOrder, byteSize, byteAlignment, stride,
    array: Object.freeze({ element, length }),
    read: (): FixedArray<Element, Length> => { throw new TypeError("Managed array-address layout has no byte codec."); },
    write: (): void => { throw new TypeError("Managed array-address layout has no byte codec."); },
  });
  validateMemoryLayout(layout);
  if (BigInt(byteSize) < minimumSize || count !== 0n && byteAlignment % element.byteAlignment !== 0) {
    throw new RangeError("Array address layout does not contain its exact element extent and alignment.");
  }
  return layout;
}

import { littleEndian, validateMemoryLayout } from "./layout.js";
import type { ByteOrder, MemoryLayout } from "./layout.js";

function scalar<T>(codec: MemoryLayout<T>["codec"], byteOrder: ByteOrder, byteSize: number, byteAlignment: number, stride: number, read: (bytes: DataView) => T, write: (bytes: DataView, value: T) => void): MemoryLayout<T> {
  const layout = Object.freeze({ codec, byteOrder, byteSize, byteAlignment, stride, read, write });
  validateMemoryLayout(layout);
  return layout;
}

export function int8Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<number> {
  littleEndian(order);
  return scalar("int8", order, 1, byteAlignment, stride, bytes => bytes.getInt8(0), (bytes, value) => bytes.setInt8(0, value));
}

export function uint8Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<number> {
  littleEndian(order);
  return scalar("uint8", order, 1, byteAlignment, stride, bytes => bytes.getUint8(0), (bytes, value) => bytes.setUint8(0, value));
}

export function int16Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar("int16", order, 2, byteAlignment, stride, bytes => bytes.getInt16(0, little), (bytes, value) => bytes.setInt16(0, value, little));
}

export function uint16Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar("uint16", order, 2, byteAlignment, stride, bytes => bytes.getUint16(0, little), (bytes, value) => bytes.setUint16(0, value, little));
}

export function int32Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar("int32", order, 4, byteAlignment, stride, bytes => bytes.getInt32(0, little), (bytes, value) => bytes.setInt32(0, value, little));
}

export function uint32Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar("uint32", order, 4, byteAlignment, stride, bytes => bytes.getUint32(0, little), (bytes, value) => bytes.setUint32(0, value, little));
}

export function int64Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<bigint> {
  const little = littleEndian(order);
  return scalar("int64", order, 8, byteAlignment, stride, bytes => bytes.getBigInt64(0, little), (bytes, value) => bytes.setBigInt64(0, value, little));
}

export function uint64Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<bigint> {
  const little = littleEndian(order);
  return scalar("uint64", order, 8, byteAlignment, stride, bytes => bytes.getBigUint64(0, little), (bytes, value) => bytes.setBigUint64(0, value, little));
}

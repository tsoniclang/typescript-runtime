import { littleEndian } from "./layout.js";
import type { ByteOrder, MemoryLayout } from "./layout.js";

function scalar<T>(byteSize: number, read: (bytes: DataView) => T, write: (bytes: DataView, value: T) => void): MemoryLayout<T> {
  return Object.freeze({ byteSize, byteAlignment: byteSize, stride: byteSize, read, write });
}

export function int8Layout(order: ByteOrder): MemoryLayout<number> {
  littleEndian(order);
  return scalar(1, bytes => bytes.getInt8(0), (bytes, value) => bytes.setInt8(0, value));
}

export function uint8Layout(order: ByteOrder): MemoryLayout<number> {
  littleEndian(order);
  return scalar(1, bytes => bytes.getUint8(0), (bytes, value) => bytes.setUint8(0, value));
}

export function int16Layout(order: ByteOrder): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar(2, bytes => bytes.getInt16(0, little), (bytes, value) => bytes.setInt16(0, value, little));
}

export function uint16Layout(order: ByteOrder): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar(2, bytes => bytes.getUint16(0, little), (bytes, value) => bytes.setUint16(0, value, little));
}

export function int32Layout(order: ByteOrder): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar(4, bytes => bytes.getInt32(0, little), (bytes, value) => bytes.setInt32(0, value, little));
}

export function uint32Layout(order: ByteOrder): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar(4, bytes => bytes.getUint32(0, little), (bytes, value) => bytes.setUint32(0, value, little));
}

export function int64Layout(order: ByteOrder): MemoryLayout<bigint> {
  const little = littleEndian(order);
  return scalar(8, bytes => bytes.getBigInt64(0, little), (bytes, value) => bytes.setBigInt64(0, value, little));
}

export function uint64Layout(order: ByteOrder): MemoryLayout<bigint> {
  const little = littleEndian(order);
  return scalar(8, bytes => bytes.getBigUint64(0, little), (bytes, value) => bytes.setBigUint64(0, value, little));
}

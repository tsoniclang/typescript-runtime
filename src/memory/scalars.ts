import { littleEndian, validateMemoryLayout } from "./layout.js";
import type { ByteOrder, MemoryLayout } from "./layout.js";
import { assertNumericMemory } from "./bytes.js";

function scalar<T>(codec: MemoryLayout<T>["codec"], byteOrder: ByteOrder, byteSize: number, byteAlignment: number, stride: number, read: (bytes: DataView) => T, write: (bytes: DataView, value: T) => void): MemoryLayout<T> {
  const layout = Object.freeze({ codec, byteOrder, byteSize, byteAlignment, stride,
    read(bytes: DataView): T { assertNumericMemory(bytes); return read(bytes); },
    write(bytes: DataView, value: T): void { assertNumericMemory(bytes); write(bytes, value); },
  });
  validateMemoryLayout(layout);
  return layout;
}

export function booleanLayout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<boolean> {
  littleEndian(order);
  return scalar("boolean", order, 1, byteAlignment, stride, bytes => {
    const value = bytes.getUint8(0);
    if (value !== 0 && value !== 1) throw new TypeError("Boolean memory requires a canonical zero or one byte.");
    return value === 1;
  }, (bytes, value) => bytes.setUint8(0, value ? 1 : 0));
}

function floatingValue(value: number): number {
  if (Number.isNaN(value)) throw new TypeError("Managed floating memory cannot preserve arbitrary NaN payloads.");
  return value;
}

export function float32Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar("float32", order, 4, byteAlignment, stride,
    bytes => floatingValue(bytes.getFloat32(0, little)),
    (bytes, value) => bytes.setFloat32(0, floatingValue(value), little));
}

export function float64Layout(order: ByteOrder, byteAlignment: number, stride: number): MemoryLayout<number> {
  const little = littleEndian(order);
  return scalar("float64", order, 8, byteAlignment, stride,
    bytes => floatingValue(bytes.getFloat64(0, little)),
    (bytes, value) => bytes.setFloat64(0, floatingValue(value), little));
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

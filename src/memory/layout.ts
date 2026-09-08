import type { MemoryPosition } from "./storage.js";
import type { PropertyIdentity } from "../location/property-identity.js";

export type ByteOrder = "little" | "big";

export interface MemoryShape {
  readonly codec: "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "int64" | "uint64" | "record" | "reference";
  readonly byteOrder: ByteOrder;
  readonly byteSize: number;
  readonly byteAlignment: number;
  readonly stride: number;
  readonly referenceIdentity?: object;
  readonly fields?: readonly { readonly key: PropertyKey; readonly byteOffset: number; readonly layout: MemoryShape }[];
}

export interface MemoryAccess {
  read<T>(byteOffset: number, layout: MemoryLayout<T>): T;
  write<T>(byteOffset: number, layout: MemoryLayout<T>, value: T): void;
  identity(byteOffset: number, layout: MemoryShape): PropertyIdentity;
}

export interface MemoryLayout<T> extends MemoryShape {
  read(bytes: DataView): T;
  write(bytes: DataView, value: T): void;
  readonly record?: {
    refresh(bytes: DataView, value: T, byteOffset: number, byteLength: number): void;
    assign(bytes: DataView, value: T, byteOffset: number, byteLength: number): void;
    view(access: MemoryAccess): T;
    position(value: T, byteOffset: number, selected?: MemoryShape): MemoryPosition | undefined;
  };
}

export function sameMemoryLayout(left: MemoryShape, right: MemoryShape): boolean {
  return left.codec === right.codec && left.byteOrder === right.byteOrder &&
    left.referenceIdentity === right.referenceIdentity &&
    left.byteSize === right.byteSize && left.byteAlignment === right.byteAlignment && left.stride === right.stride &&
    (left.fields?.length ?? 0) === (right.fields?.length ?? 0) &&
    (left.fields ?? []).every((field, index) => {
      const other = right.fields?.[index];
      return other !== undefined && field.key === other.key && field.byteOffset === other.byteOffset &&
        sameMemoryLayout(field.layout, other.layout);
    });
}

export function validateMemoryLayout<T>(layout: MemoryLayout<T>): void {
  if (!Number.isSafeInteger(layout.byteSize) || layout.byteSize <= 0 ||
      !Number.isSafeInteger(layout.byteAlignment) || layout.byteAlignment <= 0 ||
      (BigInt(layout.byteAlignment) & (BigInt(layout.byteAlignment) - 1n)) !== 0n ||
      !Number.isSafeInteger(layout.stride) || layout.stride < layout.byteSize ||
      layout.stride % layout.byteAlignment !== 0) {
    throw new RangeError("Memory layout requires a positive size, power-of-two alignment and aligned stride.");
  }
}

export function refreshMemoryValue<T>(layout: MemoryLayout<T>, bytes: DataView, current: T, byteOffset: number, byteLength: number): void {
  if (layout.record === undefined) layout.write(bytes, current);
  else layout.record.refresh(bytes, current, byteOffset, byteLength);
}

export function assignMemoryValue<T>(layout: MemoryLayout<T>, bytes: DataView, current: T, byteOffset = 0, byteLength = layout.byteSize): T {
  if (layout.record === undefined) return layout.read(bytes);
  layout.record.assign(bytes, current, byteOffset, byteLength);
  return current;
}

export function littleEndian(order: ByteOrder): boolean {
  if (order !== "little" && order !== "big") {
    throw new TypeError("Memory byte order must be explicitly selected.");
  }
  return order === "little";
}

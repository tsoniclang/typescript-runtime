export type ByteOrder = "little" | "big";

export interface MemoryLayout<T> {
  readonly byteSize: number;
  readonly byteAlignment: number;
  readonly stride: number;
  read(bytes: DataView): T;
  write(bytes: DataView, value: T): void;
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

export function littleEndian(order: ByteOrder): boolean {
  if (order !== "little" && order !== "big") {
    throw new TypeError("Memory byte order must be explicitly selected.");
  }
  return order === "little";
}

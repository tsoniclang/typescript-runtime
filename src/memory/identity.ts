import { littleEndian, validateMemoryLayout } from "./layout.js";
import type { ByteOrder, MemoryLayout } from "./layout.js";

export type IdentityDomain = "number" | "bigint" | "zero";

export function identityLayout<T>(domain: IdentityDomain, byteOrder: ByteOrder, byteSize: number, byteAlignment: number, stride: number): MemoryLayout<T> {
  littleEndian(byteOrder);
  if (domain !== "number" && domain !== "bigint" && domain !== "zero" ||
      (domain === "zero" ? byteSize !== 0 : byteSize <= 0)) {
    throw new TypeError("Managed identity layout requires its exact non-byte domain.");
  }
  const layout: MemoryLayout<T> = Object.freeze({
    codec: "identity", identityDomain: domain, byteOrder, byteSize, byteAlignment, stride,
    read: (): T => { throw new TypeError("Managed identity-only layout has no byte codec."); },
    write: (): void => { throw new TypeError("Managed identity-only layout has no byte codec."); },
  });
  validateMemoryLayout(layout);
  return layout;
}

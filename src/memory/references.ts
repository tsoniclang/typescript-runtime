import { readMemoryReference, writeMemoryReference } from "./bytes.js";
import { littleEndian, validateMemoryLayout } from "./layout.js";
import type { ByteOrder, MemoryLayout } from "./layout.js";

export function referenceLayout<T extends object>(order: ByteOrder, byteSize: number, byteAlignment: number, stride: number): MemoryLayout<T | undefined> {
  littleEndian(order);
  if (byteSize !== 4 && byteSize !== 8) throw new RangeError("Managed reference width must be four or eight bytes.");
  const domain = Object.freeze({});
  const values = new WeakMap<object, T>();
  const layout: MemoryLayout<T | undefined> = Object.freeze({
    codec: "reference", byteOrder: order, byteSize, byteAlignment, stride, referenceIdentity: domain,
    read(bytes: DataView): T | undefined {
      if (bytes.byteLength !== byteSize) throw new RangeError("Managed reference read requires its complete word.");
      const reference = readMemoryReference(bytes);
      if (reference === undefined) {
        if (new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).some(value => value !== 0)) {
          throw new TypeError("Managed reference cannot recover an unproven native address.");
        }
        return undefined;
      }
      if (reference.domain !== domain) throw new TypeError("Managed reference belongs to a different exact type domain.");
      const value = values.get(reference.token);
      if (value === undefined) throw new TypeError("Managed reference has no retained typed value.");
      return value;
    },
    write(bytes: DataView, value: T | undefined): void {
      if (bytes.byteLength !== byteSize) throw new RangeError("Managed reference write requires its complete word.");
      if (value === undefined) {
        writeMemoryReference(bytes, undefined);
        return;
      }
      const token = Object.freeze({});
      values.set(token, value);
      writeMemoryReference(bytes, Object.freeze({ domain, token, byteSize }));
    },
  });
  validateMemoryLayout(layout);
  return layout;
}

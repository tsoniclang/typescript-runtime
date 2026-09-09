import type { MemoryLayout } from "./layout.js";
import type { MemoryStorage } from "./storage.js";
import { validateMemoryRange } from "./storage.js";
import { memoryAddress, memoryPositionIdentity } from "./address.js";

export function readMemoryValue<T>(storage: MemoryStorage, byteOffset: number, layout: MemoryLayout<T>): T {
  validateMemoryRange(storage, byteOffset, layout.byteSize);
  if (layout.record !== undefined) {
    return layout.record.view({
      read: <Field>(offset: number, child: MemoryLayout<Field>): Field =>
        readMemoryValue(storage, byteOffset + offset, child),
      write: <Field>(offset: number, child: MemoryLayout<Field>, value: Field): void =>
        writeMemoryValue(storage, byteOffset + offset, child, value),
      identity: (offset, child) => ({
        ...memoryPositionIdentity(storage.typedPosition(byteOffset + offset, child)),
        address: memoryAddress(storage, byteOffset + offset),
      }),
    });
  }
  const bytes = storage.read(byteOffset, layout.byteSize);
  return layout.read(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
}

export function writeMemoryValue<T>(storage: MemoryStorage, byteOffset: number, layout: MemoryLayout<T>, value: T): void {
  validateMemoryRange(storage, byteOffset, layout.byteSize);
  const bytes = layout.record === undefined ? new Uint8Array(layout.byteSize) : storage.read(byteOffset, layout.byteSize);
  layout.write(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), value);
  storage.write(byteOffset, bytes);
}

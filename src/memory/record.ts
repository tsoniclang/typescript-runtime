import { littleEndian, refreshMemoryValue, sameMemoryLayout, validateMemoryLayout } from "./layout.js";
import type { ByteOrder, MemoryAccess, MemoryLayout, MemoryShape } from "./layout.js";
import type { MemoryPosition } from "./storage.js";
import { propertyIdentity, retainPropertyIdentity } from "../location/property-identity.js";
import { memoryPositionIdentity } from "./address.js";

export interface RecordField<T extends object, Key extends keyof T = keyof T> {
  readonly key: Key;
  readonly byteOffset: number;
  readonly layout: MemoryLayout<T[Key]>;
  write(bytes: DataView, value: T, byteOffset: number, byteLength: number): void;
  assign(bytes: DataView, value: T, byteOffset: number, byteLength: number): void;
  position(value: T, byteOffset: number, selected?: MemoryShape): MemoryPosition | undefined;
}

export function recordField<T extends object, Key extends keyof T>(key: Key, byteOffset: number, layout: MemoryLayout<T[Key]>): RecordField<T, Key> {
  validateMemoryLayout(layout);
  if (!Number.isSafeInteger(byteOffset) || byteOffset < 0 || byteOffset % layout.byteAlignment !== 0) {
    throw new RangeError("Record field requires an exact aligned byte offset.");
  }
  return Object.freeze({
    key, byteOffset, layout,
    write(bytes: DataView, value: T, offset: number, length: number): void {
      refreshMemoryValue(layout, fieldBytes(bytes, byteOffset, layout.byteSize), value[key], offset, length);
    },
    assign(bytes: DataView, value: T, offset: number, length: number): void {
      const selected = fieldBytes(bytes, byteOffset, layout.byteSize);
      if (layout.record === undefined) value[key] = layout.read(selected);
      else layout.record.assign(selected, value[key], offset, length);
    },
    position(value: T, offset: number, selected?: MemoryShape): MemoryPosition | undefined {
      const displacement = offset - byteOffset;
      if (displacement < 0 || displacement >= layout.byteSize) return undefined;
      const selectedIdentity = propertyIdentity(value, key);
      if (displacement === 0 && selected !== undefined && sameMemoryLayout(layout, selected)) {
        return { ...selectedIdentity, displacement: 0 };
      }
      return layout.record?.position(value[key], displacement, selected) ?? { ...selectedIdentity, displacement };
    },
  });
}

export function recordLayout<T extends object>(
  byteOrder: ByteOrder,
  byteSize: number,
  byteAlignment: number,
  stride: number,
  selectedFields: readonly RecordField<T>[],
  view: (access: MemoryAccess) => T,
): MemoryLayout<T> {
  littleEndian(byteOrder);
  const fields = Object.freeze([...selectedFields].sort((left, right) => left.byteOffset - right.byteOffset));
  const keys = new Set<keyof T>();
  let end = 0;
  for (const field of fields) {
    if (keys.has(field.key) || field.byteOffset < end || field.byteOffset + field.layout.byteSize > byteSize ||
        byteAlignment % field.layout.byteAlignment !== 0 || field.layout.byteOrder !== byteOrder) {
      throw new RangeError("Record fields require unique keys, disjoint in-bounds ranges and compatible layouts.");
    }
    keys.add(field.key);
    end = field.byteOffset + field.layout.byteSize;
  }
  if (fields.length === 0) throw new TypeError("Record memory requires explicit fields.");
  const layout: MemoryLayout<T> = Object.freeze({
    codec: "record", byteOrder, byteSize, byteAlignment, stride, fields,
    read(bytes: DataView): T {
      const copy = new Uint8Array(byteSize);
      copy.set(new Uint8Array(bytes.buffer, bytes.byteOffset, byteSize));
      return view(byteAccess(new DataView(copy.buffer)));
    },
    write(bytes: DataView, value: T): void {
      eachField(fields, 0, byteSize, (field, offset, length) => field.write(bytes, value, offset, length));
    },
    record: Object.freeze({
      view(access: MemoryAccess): T {
        const result = view(access);
        retainPropertyIdentity(result, key => {
          const field = fields.find(candidate => candidate.key === key);
          return field === undefined ? undefined : access.identity(field.byteOffset, field.layout);
        });
        return result;
      },
      refresh(bytes: DataView, value: T, byteOffset: number, byteLength: number): void {
        eachField(fields, byteOffset, byteLength, (field, offset, length) => field.write(bytes, value, offset, length));
      },
      assign(bytes: DataView, value: T, byteOffset: number, byteLength: number): void {
        eachField(fields, byteOffset, byteLength, (field, offset, length) => field.assign(bytes, value, offset, length));
      },
      position(value: T, byteOffset: number, selected?: MemoryShape): MemoryPosition | undefined {
        return fields[firstField(fields, byteOffset)]?.position(value, byteOffset, selected);
      },
    }),
  });
  validateMemoryLayout(layout);
  return layout;
}

function firstField<T extends object>(fields: readonly RecordField<T>[], byteOffset: number): number {
  let lower = 0;
  let upper = fields.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const field = fields[middle];
    if (field !== undefined && field.byteOffset + field.layout.byteSize <= byteOffset) lower = middle + 1;
    else upper = middle;
  }
  return lower;
}

function eachField<T extends object>(fields: readonly RecordField<T>[], byteOffset: number, byteLength: number,
  action: (field: RecordField<T>, byteOffset: number, byteLength: number) => void): void {
  if (byteLength === 0) return;
  const end = byteOffset + byteLength;
  for (let index = firstField(fields, byteOffset); index < fields.length; index++) {
    const field = fields[index];
    if (field === undefined || field.byteOffset >= end) break;
    const offset = Math.max(byteOffset - field.byteOffset, 0);
    action(field, offset, Math.min(field.layout.byteSize, end - field.byteOffset) - offset);
  }
}

function byteAccess(bytes: DataView): MemoryAccess {
  return {
    read: <Field>(byteOffset: number, layout: MemoryLayout<Field>): Field => {
      const selected = fieldBytes(bytes, byteOffset, layout.byteSize);
      return layout.record === undefined ? layout.read(selected) : layout.record.view(byteAccess(selected));
    },
    write: <Field>(byteOffset: number, layout: MemoryLayout<Field>, value: Field): void => {
      layout.write(fieldBytes(bytes, byteOffset, layout.byteSize), value);
    },
    identity: (byteOffset: number) => memoryPositionIdentity({ identity: bytes.buffer, key: undefined,
      displacement: bytes.byteOffset + byteOffset }),
  };
}

function fieldBytes(bytes: DataView, byteOffset: number, byteSize: number): DataView {
  if (byteOffset < 0 || byteOffset + byteSize > bytes.byteLength) throw new RangeError("Record field exceeds its byte window.");
  return new DataView(bytes.buffer, bytes.byteOffset + byteOffset, byteSize);
}

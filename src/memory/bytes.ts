export interface MemoryReference {
  readonly domain: object;
  readonly token: object;
  readonly byteSize: number;
}

const references = new WeakMap<ArrayBufferLike, Map<number, MemoryReference>>();

function selectedReferences(view: DataView, offset: number, length: number): readonly [number, MemoryReference][] {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > view.byteLength) {
    throw new RangeError("Memory byte window is outside its retained storage.");
  }
  const slots = references.get(view.buffer);
  if (slots === undefined || slots.size === 0 || length === 0) return [];
  const start = view.byteOffset + offset;
  const end = start + length;
  const selected: [number, MemoryReference][] = [];
  for (let position = Math.max(0, start - 7); position < end; position++) {
    const reference = slots.get(position);
    if (reference === undefined || position + reference.byteSize <= start) continue;
    if (position < start || position + reference.byteSize > end) {
      throw new TypeError("Managed memory cannot split a pointer reference into native pointer bits.");
    }
    selected.push([position, reference]);
  }
  return selected;
}

export function assertNumericMemory(view: DataView): void {
  if (selectedReferences(view, 0, view.byteLength).length !== 0) {
    throw new TypeError("Managed memory does not expose native pointer bits.");
  }
}

export function readMemoryBytes(view: DataView, offset: number, length: number): Uint8Array {
  const selected = selectedReferences(view, offset, length);
  const result = new Uint8Array(view.buffer, view.byteOffset + offset, length).slice();
  if (selected.length !== 0) references.set(result.buffer, new Map(selected.map(([position, reference]) =>
    [position - view.byteOffset - offset, reference])));
  return result;
}

export function writeMemoryBytes(view: DataView, offset: number, bytes: Uint8Array): void {
  const incoming = selectedReferences(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0, bytes.byteLength);
  const previous = selectedReferences(view, offset, bytes.byteLength);
  new Uint8Array(view.buffer, view.byteOffset + offset, bytes.byteLength).set(bytes);
  let slots = references.get(view.buffer);
  if (slots !== undefined) for (const [position] of previous) slots.delete(position);
  if (incoming.length === 0) return;
  if (slots === undefined) {
    slots = new Map();
    references.set(view.buffer, slots);
  }
  for (const [position, reference] of incoming) {
    slots.set(position - bytes.byteOffset + view.byteOffset + offset, reference);
  }
}

export function readMemoryReference(view: DataView): MemoryReference | undefined {
  const selected = selectedReferences(view, 0, view.byteLength);
  const reference = selected[0];
  if (selected.length > 1 || reference !== undefined &&
      (reference[0] !== view.byteOffset || reference[1].byteSize !== view.byteLength)) {
    throw new TypeError("Pointer storage requires one complete reference word.");
  }
  return reference?.[1];
}

export function writeMemoryReference(view: DataView, reference: MemoryReference | undefined): void {
  if (reference !== undefined && (reference.byteSize !== view.byteLength || reference.byteSize !== 4 && reference.byteSize !== 8)) {
    throw new TypeError("Managed reference requires one exact pointer-width word.");
  }
  writeMemoryBytes(view, 0, new Uint8Array(view.byteLength));
  if (reference === undefined) return;
  let slots = references.get(view.buffer);
  if (slots === undefined) {
    slots = new Map();
    references.set(view.buffer, slots);
  }
  slots.set(view.byteOffset, reference);
}

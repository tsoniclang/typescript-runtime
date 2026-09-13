export interface FixedArray<Element, Length extends number | bigint> {
  [index: number]: Element;
  readonly length: Length;
  [Symbol.iterator](): Iterator<Element>;
}

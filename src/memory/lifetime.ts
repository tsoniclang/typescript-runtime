export function keepAlive<T>(value: T): void {
  new WeakRef({ value });
}

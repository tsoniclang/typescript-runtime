const projections = new WeakSet<object>();

export function retainLocationProjection(location: object): void {
  projections.add(location);
}

export function hasLocationProjection(location: object): boolean {
  return projections.has(location);
}

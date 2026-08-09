const objectIdentityHashes = new WeakMap<object, number>();
let nextObjectIdentityHash = 1;

export function hashObjectIdentity(identity: object): number {
  const existing = objectIdentityHashes.get(identity);
  if (existing !== undefined) {
    return existing;
  }
  const hash = nextObjectIdentityHash;
  nextObjectIdentityHash = nextObjectIdentityHash === Number.MAX_SAFE_INTEGER
    ? 1
    : nextObjectIdentityHash + 1;
  objectIdentityHashes.set(identity, hash);
  return hash;
}

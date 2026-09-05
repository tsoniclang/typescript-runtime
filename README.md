# TypeScript Runtime For Tsonic

`@tsonic/typescript-runtime` contains the small ordinary-TypeScript runtime
surface required by `@tsonic/target-typescript` after semantic facts have been
lowered. It owns representations, not source-marker recognition or compiler
semantics.

The initial `Location<T>` API preserves typed pointer location identity:

```ts
const first = location(10);
const alias = first;
alias.value += 1;
console.log(first.value); // 11
```

Addressed object properties and indexed elements use `propertyLocation`, which
captures the base and key once while preserving reads and writes through the
original storage. `sameLocation` compares the underlying storage identity, so
separately created property locations for the same base and key compare equal.
`hashLocation` derives a stable process-local hash from that same identity, and
`projectLocation` preserves the identity while adapting reads and writes between
two statically selected value representations.

Layout-backed raw pointers retain live storage rather than a copied value:

```ts
const count = location(1);
const layout = int32Layout("little");
const raw = toRawPointer(count, layout);
const alias = reinterpretRawPointer(raw, layout);
if (alias !== undefined) alias.value = 7;
console.log(count.value);
```

The example prints `7`. `offsetRawPointer` selects a byte position within that
retained allocation; a narrower typed view can read or write those bytes using
the explicitly selected byte order. Nil, invalid integer offsets, misalignment
and out-of-bounds views fail deterministically. Equality and hashing use the
same location identity as typed pointers, including independent property
addresses and projected locations.

This is retained managed storage, not a native-address emulator. There is no
arbitrary-object raw constructor, integer/address registry, native pinning, or
implicit source-language layout inference. The target must select and prove
its exact codecs; generic aggregates and physical-address observations are not
certified merely because a `MemoryLayout<T>` can be declared.

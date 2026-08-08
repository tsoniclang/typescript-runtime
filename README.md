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

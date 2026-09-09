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

`keepAlive(value)` is a lexical managed-reachability barrier. It retains one
closed carrier for the current ECMAScript job using the standard WeakRef
constructor's kept-object rule, then releases that retention automatically.
It neither inspects the value nor pins a native address. It is not a global
root registry and does not authorize asynchronous foreign use after the job.
The guarded GC proof includes an omitted-barrier control and verifies both
transitive survival during the job and collection after it.

The [ECMAScript WeakRef constructor](https://tc39.es/ecma262/multipage/managing-memory.html#sec-weak-ref-constructor)
owns that job-local retention guarantee.

Layout-backed raw pointers retain live storage rather than a copied value:

```ts
const count = location(1);
const layout = int32Layout("little", 4, 4);
const raw = toRawPointer(count, layout);
const alias = reinterpretRawPointer(raw, layout);
if (alias !== undefined) alias.value = 7;
console.log(count.value);
```

The example prints `7`. Scalar codecs take explicit byte order, alignment, and
stride; width does not imply source alignment (`uint64Layout("little", 4, 8)`
represents an eight-byte value with four-byte alignment). Layout construction
rejects invalid dimensions. `offsetRawPointer` selects a byte position within the
retained pointee view; a narrower typed view can read or write those bytes using
the explicitly selected byte order. Nil, invalid integer offsets, misalignment
and out-of-bounds views fail deterministically. Equality and hashing use the
same location identity as typed pointers, including independent property
addresses and projected locations.

This is retained managed storage, not a native-address emulator. There is no
arbitrary-object raw constructor, integer/address registry, native pinning, or
implicit source-language layout inference. The target must select and prove
its exact codecs; generic aggregates and physical-address observations are not
certified merely because a `MemoryLayout<T>` can be declared.

Boolean memory uses one byte with exact zero/one encodings. Float32 and float64
codecs preserve finite IEEE values, signed zero, subnormals and infinities with
explicit byte order; float32 writes round to the selected width. Invalid boolean
bytes and floating NaN reads/writes reject rather than invent a truth value or
normalize an unrepresentable NaN payload. Ordinary arithmetic remains separate
from this managed-memory boundary.

The supplied codec determines a scalar view's byte extent. A property location
alone does not establish its containing allocation. For a target-proved fixed
array, `arrayElementLocation(values, index, layout)` instead retains the complete
array: advancing the first element address by one stride reaches the second,
including addresses obtained independently before raw conversion. The allocation
preserves padding and reads/writes only the touched element window. Resizing or
changing its selected element layout rejects. The target must prove closure and
non-reassignment before selecting this representation. Aggregate object storage,
descriptor transport and native-address observations remain separate contracts.

For target-proven value records, `recordField` captures a typed field codec and
`recordLayout` combines those fields with a generated accessor-view constructor.
Whole-record writes update the original fields rather than replacing the
object; nested writes preserve existing nested-field aliases. Views address the
same storage, including stable equality and hashes for independently obtained
field locations. Field addresses obtained through such views retain the
containing allocation. Padding survives between accesses to the same
allocation. Narrow byte windows select intersecting fields with an ordered
index; they do not serialize every field of a wide record.
No reflection, erased typed payload registry, or numeric address emulation is
involved. Pointer leaves and source-language descriptors require their own
admitted transport; integer-record codecs do not certify them.

`referenceLayout<T>` owns one statically typed managed-reference domain. Its
four- or eight-byte words retain opaque relocation tokens, not fabricated
native addresses. Relocation-aware byte copies preserve the referenced value;
nil is a zero word. Partial pointer-word copies, numeric observations of a
non-nil pointer and decoding through another domain reject explicitly. The
target must share the exact domain where source contracts require it; creating
two descriptors is not a proof that their erased TypeScript types agree.
This runtime capability does not certify cross-file target type transport or
source-language descriptor/lifetime integration.

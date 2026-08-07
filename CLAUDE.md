# Agent Notes (TypeScript Runtime)

`AGENTS.md` and `CLAUDE.md` must remain byte-identical. Apply every change to
both and verify with `cmp`.

## Begin With WCBUBWHB

Every task begins by identifying the observed artifact, complete semantic
class, sole truth owner, highest correct fix, superseded path to delete,
simplest exact output, staticness/size/runtime consequences, source-to-output
example, independent proof, and broad deletion search.

Do not patch a reproduction and justify it afterward. A repeated workaround
reopens its shared owner.

## Ownership

This package owns only ordinary TypeScript runtime representations required by
the TypeScript target after fact-driven lowering. It does not recognize source
markers, parse source, select semantics, inspect TSTS facts, or implement Go
language policy.

One runtime abstraction has one implementation. Do not add compatibility
aliases, target-independent marker declarations, reflection, dynamic shape
inspection, `any`, `unknown`, unchecked casts, or source-name dispatch.

Runtime APIs must be minimal, statically typed, ESM-only, and directly
executable on supported Node.js versions. Add an operation only after target
evidence proves native TypeScript cannot preserve the required behavior.

## Verification

Every runtime capability starts with a failing focused test and closes with:

1. strict TypeScript build;
2. executable identity/alias/mutation tests;
3. a mutation that distinguishes the required semantics;
4. public declaration and emitted-JavaScript inspection;
5. source-size and runtime-cost review; and
6. broad searches for duplicate or dynamic paths.

Keep maintained source files focused and below 600 physical lines. Use
`apply_patch` for edits, never `git stash`, never force-push, and never delete
remote branches or tags. Work on feature branches and keep generated artifacts
reproducible. Use `.temp/` only for ignored scratch evidence.

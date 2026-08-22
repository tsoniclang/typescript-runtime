# Agent Notes (TypeScript Runtime)

The canonical workspace policy in `../AGENTS.md` applies. This file contains
only TypeScript-runtime ownership and verification rules.

## Ownership

This package owns only ordinary TypeScript runtime representations required by
the TypeScript target after fact-driven lowering. It does not recognize source
markers, parse source, select semantics, inspect TSTS facts, or implement Go
language policy.

Runtime APIs must be minimal, statically typed, and directly executable on
supported Node.js versions. Add an operation only after target evidence proves
native TypeScript cannot preserve the required behavior.

## Verification

Every runtime capability starts with a failing focused test and closes with:

1. strict TypeScript build;
2. executable identity/alias/mutation tests;
3. a mutation that distinguishes the required semantics;
4. public declaration and emitted-JavaScript inspection;
5. source-size and runtime-cost review; and
6. broad searches for duplicate or dynamic paths.

Keep maintained source files focused and below 600 physical lines. Keep
generated artifacts reproducible from checked-in inputs.

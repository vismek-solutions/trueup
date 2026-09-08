---
title: Placement
description: Where a file should live, given who uses it — and when a directory has become a drawer.
---

Boundaries govern what a file may reach. These govern where files sit.

## Colocation: code that crossed a boundary for one caller

If exactly one other zone uses a value, that value is not shared code — it is that zone's code, sitting on the wrong side of a boundary.

```ts
colocation: true,
```

Turn it on in the shop project from [getting started](/start/getting-started/) and three exports turn out to have exactly one customer each:

```
no-value-is-declared-away-from-its-only-consumer  3 errors
    src/api/money.ts  declares formatMoney, used only by src/components/CartRow.tsx
    src/components/CartRow.tsx  declares CartRow, used only by src/hooks/useCart.ts
    src/domain/order.ts  declares isSettled, used only by server/routes.ts
```

`isSettled` sits in `domain`, where shared business rules go, and only the server ever asks. Move it into the server until a second caller turns up. A second consumer arriving later is a reason to move it back then, not a reason to have guessed now.

### What is never counted as the lone consumer

**A zone with a `role` is never counted as the lone consumer.** Composition roots and test suites use other zones' code without ever being where that code belongs. A root wires each collaborator exactly once. A test imports whatever it exercises. Left in, they bury the real findings.

```ts
{ name: "spec", patterns: ["**/*.test.ts", "**/*.fixture.ts"], role: "tests" },
{ name: "app",  patterns: ["src/**"], role: "wiring" },
```

Those two lines are what keeps `StatusBadge` and `useCart` off the list above: `src/main.ts` imports each exactly once, and wiring is all it does.

**Type-only edges are ignored.** A type gets used constantly without being imported — reading `record.exports[0].form` uses that type and names nothing. Import counts tell the truth about values and lie about types.

Measured on a 911-file monorepo: 758 findings unfiltered, 47 with both exclusions. Ten of the 47 were values in a shared package that only one app used — the case that counting files per symbol misses entirely.

### Exports that exist only for a test

This second check needs both `colocation: true` and at least one zone with `role: "tests"`. Given those, declaring the test zone turns the question around.

Something that *only* the tests import is not shared code with one consumer. It is private code made public so a test could reach in.

```
no-export-exists-only-for-a-test          3 errors
    src/case/anchor.ts   exports EPOCH_START, which only tests use
    src/case/prompt.ts   exports CAST_RULES, which only tests use
    src/access/gate.ts   exports resourceAccess, which only tests use
```

The fix is to test the behaviour through the surface production code actually calls.

A helper that genuinely exists to serve tests belongs in the tests zone. Putting `**/*.fixture.ts` in that zone removed a quarter of this check's findings on that monorepo — fixtures are test code, and zoning them as such is the right fix rather than an exception inside the rule.

:::caution
Adding a production caller to satisfy the check is the one fix that makes the codebase worse. The printed guidance says so.
:::

## Tests that reach an internal

```ts
testInternals: true,
```

A separate switch from `colocation`, and off by default. It reports a test importing a symbol that nothing outside the symbol's own directory calls.

```
no-test-reaches-an-internal                 1 error
    test/checkout.test.ts  reaches priceWithTax, an internal of src/checkout/tax.ts that only src/checkout/total.ts calls
```

`priceWithTax` exists because `orderTotal` needed it. Fold it back into `total.ts` and nothing about the checkout behaves differently — but the test breaks. That is what it means for a test to be pinned to a decomposition rather than to behaviour, and an agent refactoring `checkout` later reads the red suite as a regression.

The fix is to drive the same cases through `orderTotal`, which is what production calls. When that is genuinely too expensive, the symbol is asking to become a module with a caller of its own rather than a wider surface on the one it sits in.

Nothing is reported for `orderTotal` or `toCents` in that run: both have a consumer in `src/web`, so their surface already reaches past the directory and a test is welcome there too.

Three kinds of symbol are never reported. One a zone with `role: "wiring"` declares, because a composition root has no internals to protect. One a zone with `role: "api"` re-exports, which is surface wherever it happens to be declared — a `export { x } from "./x.ts"` leaves no import edge behind, so this is read from the api zone's exports rather than its imports. And one no test reaches at all, which is nobody's business but its own.

This is the mirror of the test-only export above. That check asks whether production uses a symbol; this one asks whether production uses it from far enough away to call it a surface.

:::caution
Widening the surface so the direct test becomes legitimate, and adding a production caller to justify it, both leave the codebase worse than the finding did.
:::

With no zone carrying `role: "tests"`, the check warns rather than passing — there is nothing to hold to a surface, and silence would read as a pass.

## Directory size

```ts
maxFilesPerDirectory: 12
```

A directory that keeps growing has stopped being one idea. An agent adding the twenty-first file to a folder has no way to notice that from inside the file it is writing.

```
no-directory-holds-too-many-files           2 errors
    src/adapters  holds 12 files, more than the 8 allowed
    src/claims  holds 11 files, more than the 8 allowed
    A directory holds more files than the limit, which is how a folder stops being one idea and
    turns into a drawer. Group the related files into a subdirectory that names what they share, or
    move out the ones that never belonged. Raising the limit is not the fix: the number exists to
    force the question of what this directory is for.
```

The count includes every file the analysis read, unclassified ones included. A directory nothing has claimed is the likeliest dumping ground.

There is no exemption list, because a limit with an exemption list is a limit nobody has to meet. The number is the only lever.

### Picking the number

There is no default, and the right value depends on how you group files. A repository that puts each unit in its own directory sits comfortably around 12. A flat `components` folder with one file per component will not: 40 files there is ordinary, and the check is reporting a shape you may already be happy with.

If that is your shape, you have two honest answers. Set the number where it catches genuine drawers for you — 30, 50 — so it still fires when a folder doubles. Or group the folder into subdirectories by feature, which is what the check is nudging toward, and keep a low number.

What is not an answer is exempting the one directory that fails. Start high enough that the first run reports a handful of real cases rather than a wall, then lower it as those get fixed.

Line and function length are a linter's job, not this one's. [Delegate them](/integrations/linters/).

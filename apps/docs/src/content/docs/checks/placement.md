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

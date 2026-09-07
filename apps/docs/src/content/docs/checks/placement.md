---
title: Placement
description: Where a file should live, given who uses it — and when a directory has become a drawer.
---

Boundaries govern what a file may reach. These govern where files sit.

## Code that crossed a boundary for one caller

```ts
colocation: true,
zones: [
  { name: "spec", patterns: ["**/*.test.ts", "**/*.fixture.ts"], role: "tests" },
  { name: "root", patterns: ["src/main.ts"], role: "wiring" },
  { name: "shared", patterns: ["packages/shared/**"] },
  { name: "web", patterns: ["apps/web/**"] },
]
```

A value exported from one zone and used by only one other zone is paying for a boundary that carries nothing a second caller needs.

A symbol in a shared package that exactly one app imports is not shared code. It is that app's code, in the wrong package. Move it there. A second consumer showing up later is a reason to move it back then, not a reason to have guessed now.

### Two exclusions, both load-bearing

**A zone with a `role` is never counted as the lone consumer.** Composition roots and test suites use other zones' code without ever being where that code belongs. A root wires each collaborator exactly once. A test imports whatever it exercises. Left in, they bury the real findings.

**Type-only edges are ignored.** A type gets used constantly without being imported — reading `record.exports[0].form` uses that type and names nothing. Import counts tell the truth about values and lie about types.

Measured on a 911-file monorepo: 758 findings unfiltered, 47 with both exclusions. Ten of those 47 were values in a shared package that only one app used, which is the case that counting files per symbol misses entirely.

### Exports that exist only for a test

Declaring a zone with `role: "tests"` also turns the question around.

Something that *only* the tests import is not shared code with one consumer. It is private code made public so a test could reach in.

```
no-export-exists-only-for-a-test          3 errors
    src/case/anchor.ts   exports EPOCH_START, which only tests use
    src/case/prompt.ts   exports CAST_RULES, which only tests use
    src/access/gate.ts   exports resourceAccess, which only tests use
```

The fix is to test the behaviour through the surface production code actually calls.

A helper that genuinely exists to serve tests belongs in the tests zone. Put `**/*.fixture.ts` in that zone and its false positives go with it — worth 39 of 169 findings on that monorepo.

:::caution
Adding a production caller to satisfy the check is the one fix that makes the codebase worse. The printed guidance says so.
:::

## Directory size

```ts
maxFilesPerDirectory: 12
```

A directory that keeps growing has stopped being one idea. An agent adding the twenty-first file to a folder has no way to notice that from inside the file it is writing.

The count includes every file the analysis read, unclassified ones included. A directory nothing has claimed is the likeliest dumping ground.

There is no exemption list, because a limit with an exemption list is a limit nobody has to meet.

Line and function length are a linter's job, not this one's. [Delegate them](/integrations/linters/).

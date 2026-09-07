---
title: The same thing written twice
description: The one rule here that judges an edge which should exist and does not.
---

```ts
duplication: 60
```

Every other rule here judges an edge that exists and should not. This one judges an edge that should exist and does not.

That gap is where an agent lives. It does not find what is already there, so it writes it again. Each copy is individually correct, three lines long, and passes review. Meanwhile the codebase grows a second answer to a question it had already answered.

Nothing else catches it. The copies are all used, so a dead-code checker sees nothing. They sit in different files, so a linter sees nothing. And they are far too small for a copy-paste detector to report without burying you.

## What it compares

The number is the shortest declaration worth reporting, in characters, with runs of whitespace collapsed to one space.

A declaration's **name is not part of the comparison**. A copy that was renamed on the way is still a copy, and renaming is exactly what happens when the second one is written from memory rather than pasted.

```
no-declaration-is-written-twice             3 errors
    src/zones/assign.ts:11:6      declares toPosix, which is written the same way in src/claims/isolation.ts, src/guard/protected.ts
    src/claims/isolation.ts:17:6  declares posix, which is written the same way in src/guard/protected.ts, src/zones/assign.ts
    src/guard/protected.ts:26:6   declares posix, which is written the same way in src/claims/isolation.ts, src/zones/assign.ts
```

Those three are real, and they are from this tool's own repository.

## Picking the number

Start around 60 and read what comes back. Lower finds more real duplication and more shared test scaffolding; higher finds only the large copies.

On that repository, 60 reports 28 and 100 reports 4. There is no default, because the right number depends on how much of your test setup you consider worth sharing.

Two findings that are not bugs are worth expecting. Fixture path constants repeated across test files are genuinely the same declaration, and you may decide that is fine. And two types can be structurally identical while meaning different things — when that happens they were two ideas wearing one shape, and the fix is to name them apart rather than to merge them.

## Fixing one is a three-step edit, in this order

The rule blocks creating the shared module while the copies still exist, and blocks importing a module that does not exist yet. So:

1. Delete the copies. References are temporarily undefined, which is a type error but not an architecture one.
2. Create the shared module.
3. Add the imports.

A shared helper needs a zone every caller may reach, and that zone should be a leaf — named for what it holds, never for being miscellaneous, and forbidden from reaching anything. A generic `util` zone is the drawer the [directory-size rule](/checks/placement/#directory-size) exists to prevent.

:::caution
Writing the shared copy in a deliberately different shape to slip past the rule is the move the printed guidance forbids.
:::

## This is not clone detection

A clone detector compares blocks of lines and needs them long enough to be sure. This compares whole declarations, which is why a 60-character threshold is usable at all.

The two do not overlap, measured: on this tool's repository the declaration rule at 60 characters reports nothing that a clone detector at its defaults also reports, and lowering a clone detector far enough to see declaration-sized copies reports 27% of the codebase. Run both — [the delegated one](/integrations/linters/#copy-paste-from-fallow) finds the near-miss copies this rule structurally cannot.

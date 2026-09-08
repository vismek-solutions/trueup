---
title: The same thing written twice
description: The one rule here that judges an edge which should exist and does not.
---

```ts
duplication: 60
```

Every other rule here judges an import that exists and should not. This one judges an import that should exist and does not — the missing edge between a declaration and the copy someone wrote instead.

An agent that cannot find the existing helper writes a new one. Each copy is individually correct, three lines long, and passes review. Meanwhile the codebase grows a second answer to a question it had already answered.

Three other kinds of tool miss it. Every copy is used, so a dead-code checker passes. The copies sit in different files, so a linter passes. And they are far too small for a copy-paste detector to report without burying you.

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

Two kinds of finding are not bugs. Fixture path constants repeated across test files are genuinely the same declaration, and you may decide that is fine. And two types can be structurally identical while meaning different things — when that happens they were two ideas wearing one shape, and the fix is to name them apart rather than to merge them.

## Fixing one

The order only matters with [the write-time guard](/agents/guard/) installed. The guard would refuse a third copy while the originals stand, and refuse an import of a module that does not exist yet. Running the check on its own, only the end state is judged. Running the check on its own, any order works and only the end state is judged.

1. Delete the copies. References are temporarily undefined, which is a type error but not an architecture one.
2. Create the shared module.
3. Add the imports.

A shared helper needs a zone every caller may reach, and that zone should be a leaf — named for what it holds, never for being miscellaneous, and forbidden from reaching anything. A generic `util` zone is the drawer the [directory-size rule](/checks/placement/#directory-size) exists to prevent.

:::caution
Writing the shared copy in a deliberately different shape to slip past the rule is the move the printed guidance forbids.
:::

## This is not clone detection

A clone detector compares blocks of lines and needs them long enough to be sure. This compares whole declarations, which is why a 60-character threshold is usable at all.

The two do not overlap, and there is no setting in between. Measured against a project holding one genuine three-line renamed copy, and against this tool's own repository:

| | the renamed copy | this repository |
|---|---|---|
| fallow at its defaults | missed | 0 |
| fallow at 3 lines, 40 tokens | missed | 0 |
| fallow at 1 line, 5 tokens, identifiers blinded | found, plus an invented group on three files | 886 groups, 90% of the codebase |
| this rule | exactly the pair | 0 |

The gap is structural rather than a tuning accident. A clone detector slides a window over a token stream. It needs enough tokens for a match not to be coincidence, so lowering the window to declaration size makes everything match everything.

Comparing whole declarations removes the window. A short body is a complete unit of meaning, not an arbitrary span — so a small threshold stays sharp.

Run both. [The delegated detector](/integrations/linters/#copy-paste-from-fallow) finds the near-miss copies this rule structurally cannot.

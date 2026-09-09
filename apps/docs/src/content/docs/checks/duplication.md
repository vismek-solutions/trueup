---
title: The same thing written twice
description: The one check here that looks for an import which should exist and does not.
---

```ts
duplication: 60
```

Every other check on this site judges an import that exists and should not. This one judges an import that should exist and does not. An edge is one name imported by one file. The edge missing here would run between a declaration and the copy someone wrote instead of importing it.

An agent is a coding assistant that writes code in your project. When it cannot find the helper that already exists, it writes a new one. Each copy is individually correct, three lines long, and passes review. Meanwhile the codebase grows a second answer to a question it had already answered.

Three other kinds of tool miss this. Every copy is used, so a dead-code checker passes. The copies sit in different files, so a linter passes. And they are far too small for a copy-paste detector to report without burying you.

## What it compares

The number is the shortest declaration worth reporting, counted in characters, with runs of whitespace collapsed to one space.

A declaration's name is not part of the comparison. A copy that was renamed on the way is still a copy, and renaming is exactly what happens when the second one is written from memory rather than pasted.

```
no-declaration-is-written-twice             3 errors
    src/zones/assign.ts:11:6      declares toPosix, which is written the same way in src/claims/isolation.ts, src/guard/protected.ts
    src/claims/isolation.ts:17:6  declares posix, which is written the same way in src/guard/protected.ts, src/zones/assign.ts
    src/guard/protected.ts:26:6   declares posix, which is written the same way in src/claims/isolation.ts, src/zones/assign.ts
```

Those three are real, and they come from this tool's own repository.

## Picking the number

Start around 60 and read what comes back. A lower number finds more real duplication and more shared test scaffolding. A higher one finds only the large copies.

On that repository, 60 reports 28 and 100 reports 4. There is no default, because the right number depends on how much of your test setup you consider worth sharing.

Two kinds of finding are not bugs. Fixture path constants repeated across test files genuinely are the same declaration, and you may decide that is fine. And two types can be structurally identical while meaning different things. When that happens they were two ideas wearing one shape, and the fix is to name them apart rather than to merge them.

## Fixing one

The order below only matters once you have installed [the write-time guard](/agents/guard/). The guard inspects an edit before it is saved and can refuse it. It would refuse a third copy while the originals still stand, and refuse an import of a module that does not exist yet. Running the check on its own, any order works, and only the end state is judged.

1. Delete the copies. References are temporarily undefined, which is a type error but not an architecture one.
2. Create the shared module.
3. Add the imports.

A shared helper needs a zone every caller may reach. A zone is a name you give to a group of files, chosen by where the files sit. Make that one a leaf: named for what it holds, never for being miscellaneous, and forbidden from reaching anything. A general util zone is the drawer that the [directory-size rule](/checks/placement/#directory-size) exists to prevent.

:::caution
There is a tempting shortcut here that we would ask you to avoid: writing the shared copy in a different shape on purpose, so the rule stops matching it. The guidance printed with the finding asks for the opposite. Keep one copy, put it where every caller may reach it, and delete the rest.
:::

## This is not a copy-paste detector

A copy-paste detector compares blocks of lines. It slides a window over a stream of tokens and needs enough tokens for a match not to be coincidence, so it can only be confident about something long. This rule compares whole declarations instead. There is no window to fill, which is why a threshold of 60 characters is usable at all.

The two do not overlap, and there is no setting in between. The rows below were measured against a project holding one genuine three-line renamed copy, and against this tool's own repository. The first three are fallow, the analyzer trueup hands most of its commodity work to:

| | the renamed copy | this repository |
|---|---|---|
| fallow at its defaults | missed | 0 |
| fallow at 3 lines, 40 tokens | missed | 0 |
| fallow at 1 line, 5 tokens, identifiers blinded | found, plus an invented group on three files | 886 groups, 90% of the codebase |
| this rule | exactly the pair | 0 |

Run both. [The delegated detector](/integrations/linters/#copy-paste-from-fallow) finds the near-miss copies this rule structurally cannot.

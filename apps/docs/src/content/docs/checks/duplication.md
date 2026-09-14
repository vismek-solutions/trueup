---
title: The same thing written twice
description: The one check here that looks for an import which should exist and does not.
claims:
  - no-declaration-is-written-twice
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
    src/app/assign.ts:3:14  declares toPosix, which is written the same way in src/store/protected.ts, src/web/isolation.ts, and a shared copy may live in paths or store
    src/store/protected.ts:3:14  declares posix, which is written the same way in src/app/assign.ts, src/web/isolation.ts, and a shared copy may live in paths or store
    src/web/isolation.ts:3:14  declares posix, which is written the same way in src/app/assign.ts, src/store/protected.ts, and a shared copy may live in paths or store
```

One of those three was renamed on the way, and the check found it anyway. That is the shape of the real thing: this tool's own repository carried the same pair for a while, under two names in three zones.

## Picking the number

Start around 60 and read what comes back. A lower number finds more real duplication and more shared test scaffolding. A higher one finds only the large copies.

On that repository, 60 reports 28 and 100 reports 4. There is no default, because the right number depends on how much of your test setup you consider worth sharing.

Two kinds of finding are not bugs. Fixture path constants repeated across test files genuinely are the same declaration, and you may decide that is fine. And two types can be structurally identical while meaning different things. When that happens they were two ideas wearing one shape, and the fix is to name them apart rather than to merge them.

## Where a shared copy may live

When the copies sit in more than one zone, the finding names the zones that could hold the one you keep. A zone qualifies when every copy may reach it and it may reach whatever the declaration itself imports. A zone that holds a copy can still be the answer, so long as every other copy may reach it. What rules a zone out is one copy that could not.

Copies inside a single zone get no such list. That zone is the answer already, and printing it would be noise.

Sometimes nothing qualifies.

```
no-declaration-is-written-twice  2 errors
    src/app/one.ts:1:14  declares total, which is written the same way in src/web/two.ts, and no zone may hold a copy all of them could reach
    src/web/two.ts:1:14  declares total, which is written the same way in src/app/one.ts, and no zone may hold a copy all of them could reach
```

That is a missing zone rather than a dead end. Declare one that every copy may reach, and the next run will name it.

## Fixing one

The order below only matters once you have installed [the write-time guard](/agents/guard/). The guard inspects an edit before it is saved and can refuse it, and it would refuse an import of a module that does not exist yet. Running the check on its own, any order works, and only the end state is judged.

1. Create the shared module. A file that does not exist yet is allowed to hold declarations that still stand elsewhere, because a move looks exactly like a copy until the old one is gone.
2. In each file that held a copy, replace the declaration with an import of the new module.

The check keeps failing through the middle of that, which is the point. It stops the moment the last copy is gone.

A shared helper needs a zone every caller may reach. A zone is a name you give to a group of files, chosen by where the files sit. Make that one a leaf: named for what it holds, never for being miscellaneous, and forbidden from reaching anything. A general util zone is the drawer that the [directory-size rule](/checks/placement/#directory-size) exists to prevent.

:::caution
One fix here we would ask you to avoid: writing the shared copy in a different shape on purpose, so the rule stops matching it. The guidance printed with the finding asks for the opposite. Keep one copy, put it where every caller may reach it, and delete the rest.
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

---
title: Zones
description: A zone names a group of files by path pattern. Every other rule is written in that vocabulary.
---

A **zone** is a name for a group of files, chosen by path patterns. Zones are the vocabulary every other rule is written in, so this is the one idea to get right.

Patterns are matched against each file's path **relative to your project root**, the directory holding `trueup.config.ts`.

```ts
zones: [
  { name: "spec", patterns: ["**/*.test.ts"] },
  { name: "domain", patterns: ["src/domain/**"] },
  { name: "engine", patterns: ["src/engine/**"] },
  { name: "app", patterns: ["src/**"] },
]
```

## Order matters

A file belongs to the first zone whose pattern matches it. Order them narrowest first.

Above, `src/domain/user.test.ts` is `spec` rather than `domain`, because `spec` comes first.

## Every file must land somewhere

A file in no zone is an error. Nothing has classified it, so no rule can govern it.

Put your tests in their own zone, ahead of everything else. Left inside a source zone, they leak fixture text into the other checks.

Three claims guard the vocabulary itself, and all three are errors:

| claim | asserts |
|---|---|
| `every-file-belongs-to-a-zone` | every file matches a zone |
| `every-zone-has-a-file` | no zone is empty |
| `every-zone-pattern-matches-a-file` | no pattern is dead |

An empty zone or a dead pattern usually means a directory was renamed and a rule quietly stopped applying. That is the failure worth catching early, because nothing else about the run looks different when it happens.

## Roles

A zone can declare what kind of thing it is. The role changes what other rules count it as, and it is stated once rather than granted per rule.

```ts
zones: [
  { name: "spec", patterns: ["**/*.test.ts", "**/*.fixture.ts"], role: "tests" },
  { name: "root", patterns: ["src/main.ts"], role: "wiring" },
  { name: "api", patterns: ["src/index.ts"], role: "api" },
]
```

`wiring` marks the file that assembles everything and is imported by nothing — `src/main.tsx`, or the server entry that mounts your routers.

`tests` marks a test suite. With `colocation: true` it also enables the check for [exports that exist only for a test](/checks/placement/#exports-that-exist-only-for-a-test).

`api` marks a package's public surface. Names re-exported there answer to consumers outside the analysed code, and in a monorepo it is the only zone another member may enter.

All three are excluded from being counted as the lone consumer in the [colocation check](/checks/placement/). Without that exclusion, tests alone accounted for 646 of 758 findings on a large monorepo.

## Asking where a file belongs

```sh
npx trueup explain src/engine/newThing.ts
```

```
zone        engine
may reach   engine · shared
may not     domain
vocabulary  domain owns names this file may not use:
            Warrant · WarrantKind · warrantKinds
            and values it may not repeat:
            search · testimony
```

Useful to you when deciding where something goes, and useful to an agent told to run it before creating a file. A path in no zone is reported as such — the answer you want before making a directory nothing covers.

The `vocabulary` block only appears when a [seam rule](/checks/seams/) covers the file. Without one, the first three lines are the whole answer.

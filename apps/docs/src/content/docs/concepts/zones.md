---
title: Zones
description: A zone is a name you give to a group of files, and every other rule is written in those names.
---

A zone is a name you give to a group of files. You choose the files by their location, and you choose the name yourself.

Zones are worth taking your time over. Every other rule on this site is written in the names you invent here, so this is the one idea to get right.

You pick the files with path patterns. Each pattern is matched against a file's path relative to your project root, which is the directory holding trueup.config.ts. A pattern that starts with src therefore counts from there, not from wherever you happened to be standing when you ran the tool.

```ts
zones: [
  { name: "spec", patterns: ["**/*.test.ts"] },
  { name: "domain", patterns: ["src/domain/**"] },
  { name: "engine", patterns: ["src/engine/**"] },
  { name: "app", patterns: ["src/**"] },
]
```

The last pattern in that list is deliberately wide. It catches whatever the first three did not, and something has to.

## The first pattern that matches wins

A file belongs to the first zone whose pattern matches it, so the order you write them in is part of the rule. Put the narrow zones first and the catch-all last.

In the list above, the file src/domain/user.test.ts lands in spec rather than domain, because spec is written first.

## Every file must land somewhere

A file in no zone is an error. Nothing has classified it, so no rule can govern it.

Give your tests a zone of their own, and put it ahead of everything else. Tests left inside a source zone leak their fixture text into the other checks.

Three claims watch the zone names themselves. A claim is one sentence the tool believes about your project, which each run either proves or disproves. All three of these are errors when they fail:

| claim | what it believes |
|---|---|
| `every-file-belongs-to-a-zone` | every file matches a zone |
| `every-zone-has-a-file` | no zone is empty |
| `every-zone-pattern-matches-a-file` | no pattern is dead |

An empty zone or a dead pattern usually means a directory was renamed and a rule quietly stopped applying. Nothing else about the run looks any different when that happens, which is why it is worth catching early.

## Roles

A zone can also say what kind of thing it holds. You state that once, on the zone, and the other rules take it into account from then on, instead of you granting the same exception over and over.

```ts
zones: [
  { name: "spec", patterns: ["**/*.test.ts", "**/*.fixture.ts"], role: "tests" },
  { name: "root", patterns: ["src/main.ts"], role: "wiring" },
  { name: "api", patterns: ["src/index.ts"], role: "api" },
]
```

The wiring role marks the file that assembles everything and is imported by nothing. In a front end that is usually src/main.tsx. On a server it is the entry that mounts your routers. A file like that has no internals of its own, so [the internals check](/checks/placement/#tests-that-reach-an-internal) never reports one.

The tests role marks a test suite. With colocation switched on, it also enables the check for [exports that exist only for a test](/checks/placement/#exports-that-exist-only-for-a-test). And when you turn testInternals on, this role is how the tool knows which imports belong to a test.

The api role marks a package's public surface. Names re-exported there answer to consumers outside the code being analysed, and in a monorepo it is the only zone another member may enter. A member is one package inside a workspace that keeps its own rules. Those names also count as surface for the internals check, wherever they are declared.

None of the three roles counts as the lone consumer of a name in the [colocation check](/checks/placement/). Without that exclusion, tests alone accounted for 646 of 758 findings on a large monorepo.

## Asking where a file belongs

When you are unsure which zone something falls into, ask.

```sh
npx trueup explain src/engine/newThing.ts
```

```
src/engine/newThing.ts

zone        engine
may reach   engine · shared
may not     domain

vocabulary  domain owns names this file may not use:
            Warrant · WarrantKind · warrantKinds
            and values it may not repeat:
            search · testimony
```

Useful when you are deciding where something goes, and useful to an agent, a coding assistant that writes code in your project, if you tell it to run this before it creates a file. A path in no zone is reported as such, which is the answer you want before you make a directory nothing covers.

The vocabulary block only appears when a [seam rule](/checks/seams/) covers the file. A seam is the line between reusable code and code that knows your business. Without such a rule, the zone and its reach are the whole answer.

Add a name to the path and the question changes. Instead of where this file may reach, you are asking who reads this one thing, and what it would cost to move it somewhere else:

```sh
npx trueup explain src/engine/table.ts#rowKey
```

The answer names the files and directories that read it, the zones those readers sit in with any role they carry, whether enough of them are far enough away for a move to have somewhere to land, how many declarations would have to travel with it, and which of the ones staying behind would need to import it back. That last number is the honest price of the move.

The roles are worth reading closely there. A reader in a zone with a role is a real reader, and it is still not what the colocation check counts, so a name with three reader zones can honestly be reported as having one consumer.

## Asking where a new file may live

The question above starts from a path. Often you have the opposite: you know what the new file has to import, and the path is the part you are trying to work out.

```sh
npx trueup explain --needs=src/domain/thing.ts --read-by=src/ui/screen.ts
```

```
a new file

reaches     domain
read by     ui

may live    api  src/api
```

The first list names the files it must import. The second names the files that will import it. Both take several paths, separated by commas.

The answer is every zone allowed to reach all of the first and reachable from all of the second, with a directory where that zone's files already sit. Leave the second list off and the answer widens, because nothing yet says which zones will reach into the new file.

Sometimes no zone qualifies. That answer is the useful one, because it separates two situations that look the same while you are stuck.

```sh
npx trueup explain --needs=src/api/client.ts,src/store/db.ts
```

```
a new file

reaches     api · store
read by     nothing yet

may live    nowhere
            No zone may reach api · store at once, and a zone that may would close no
            cycle. Declare one, named for what it holds rather than for being shared.
```

That is a gap in the rules. Nothing yet describes a part of the project allowed to see both of those, and writing one down is ordinary work.

The other situation is not.

```sh
npx trueup explain --needs=src/ui/screen.ts --read-by=src/domain/thing.ts
```

```
a new file

reaches     ui
read by     domain

may live    nowhere
            A zone reaching ui and read by domain would close a cycle,
            because ui already reaches domain. This is two files rather
            than one: split it along the zones it reaches.
```

No zone can help here, because any zone that could hold the file would complete a loop. The file is doing two jobs, and you know that before writing a line of it.

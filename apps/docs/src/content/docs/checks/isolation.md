---
title: Sibling directories
description: One rule keeps routes and features apart, without naming any of them.
---

Zones are named, so a boundary between them has to be written out. That falls apart when the directories are many, similar, and constantly added to.

Think `src/routes/a`, `src/routes/b`, `src/routes/c`. The rule you want is "none of these knows about any other".

Written as zones, that needs one zone and one boundary per route. Worse, a route added tomorrow is governed by nothing until someone remembers to add it.

## Declaring a group

```ts
isolate: [{ siblings: "src/routes/*", except: ["_shared"] }]
```

The `*` names the group. Every directory it matches becomes an island.

The `*` matches a directory name, and `except` lists those names rather than paths — `_shared` above means `src/routes/_shared`.

Files inside an island may import each other freely, and may reach anything outside the group. They may not reach a sibling.

Isolation is checked independently of [boundaries](/concepts/boundaries/), so both have to pass. "May reach anything outside the group" means this check raises no objection, not that another rule cannot.

A new directory is isolated the moment it exists, with no config change. That is the whole point.

## What it reports

```
no-sibling-directory-reaches-another        2 errors
    src/routes/a/page.ts:1:0        is a and may not reach sibling b: thing from src/routes/b/thing.ts
    src/routes/c/deep/inner.ts:1:0  is c and may not reach sibling b: thing from src/routes/b/thing.ts
```

Depth does not matter. `src/routes/c/deep/inner.ts` is still `c`.

The parent itself is in no group. So `src/routes/index.ts` importing every route is fine — that is what a parent is for.

More than one `*` is allowed, and each combination is its own island. `apps/*/src/routes/*` keeps `ui/a` apart from `ui/b` and from `web/a`, across every app at once.

:::note
If the pattern matches no directory at all, that is an error rather than a silent pass. A rule guarding nothing is the failure mode this tool exists to prevent.
:::

## On `except`

`except` is for the directory the group is meant to share. Use it for `_shared` and little else.

The shared thing is usually the answer to a finding, not an exception to it.

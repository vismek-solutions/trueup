---
title: Sibling directories
description: One rule keeps routes and features apart, without naming any of them.
---

Zones are named, so a boundary between them has to be written out. That does not scale when the directories are many, alike, and added to constantly.

Think `src/routes/catalog`, `src/routes/checkout`, `src/routes/account`. The rule you want is "none of these knows about any other".

Written as zones, that needs one zone and one boundary per route. Worse, a route added tomorrow is governed by nothing until someone remembers to add it.

## Declaring a group

```ts
isolate: [{ siblings: "src/routes/*", except: ["_shared"] }]
```

The `*` names the group, and every directory it matches becomes an island. `except` lists those directory names rather than paths, so `_shared` above means `src/routes/_shared`.

Files inside an island may import each other freely, and may reach anything outside the group. They may not reach a sibling.

Isolation is checked independently of [boundaries](/concepts/boundaries/), so both have to pass. "May reach anything outside the group" means this check raises no objection, not that another rule cannot.

A new directory is isolated the moment it exists, with no config change.

## What it reports

```
no-sibling-directory-reaches-another        2 errors
    src/routes/account/orders/history.ts:1:10  is account and may not reach sibling catalog: price from src/routes/catalog/price.ts
    src/routes/checkout/page.ts:1:10  is checkout and may not reach sibling catalog: price from src/routes/catalog/price.ts
```

Depth does not matter. `src/routes/account/orders/history.ts` is still `account`.

The parent itself is in no group. So `src/routes/index.ts` importing every route is fine — that is what a parent is for, and [`wiring`](#files-that-sit-beside-the-group) is how you say which files may be there. And `catalog` importing `_shared/money.ts` raised nothing, because `except` took `_shared` out of the group.

More than one `*` is allowed, and each combination is its own island. `apps/*/src/routes/*` keeps `ui/catalog` apart from `ui/checkout` and from `web/catalog`, across every app at once.

:::note
If the pattern matches no directory at all, that is an error rather than a silent pass. A rule guarding nothing is the failure mode this tool exists to prevent.
:::

## Files that sit beside the group

A file directly in `src/routes` belongs to no island, so nothing above governs it. It may reach into every route and the check stays quiet. That is right for `index.ts`, whose job is the group, and wrong for a helper that ended up there because no one decided where it went.

`wiring` says which files may sit there. Declaring it is what turns the question on.

```ts
isolate: [{ siblings: "src/routes/*", except: ["_shared"], wiring: ["**/index.ts"] }]
```

```
no-file-sits-loose-beside-a-group           2 errors
    src/routes/formatMoney.ts  sits beside the siblings `src/routes/*` rather than in one of them
    src/routes/orderStatus.ts  sits beside the siblings `src/routes/*` rather than in one of them
```

Move each into the route that uses it, or out of the parent entirely if several do. `index.ts` went unreported because the pattern covers it, and every later file following that convention is covered too — name the convention, not the instances.

Leave `wiring` out and nothing is reported: the claim is not made at all, so adding the rule to an existing project changes nothing until you ask this question. Write `wiring: []` to ask it with no exceptions.

In a member's rulebook, `wiring` resolves against the member's own directory, the same as `siblings`.

## On `except`

`except` is for the directory the group is meant to share. Use it for `_shared` and little else.

The shared thing is usually the answer to a finding, not an exception to it.

`wiring` is the same bargain in the other direction: for a file that assembles the group, not for one you have not placed yet.

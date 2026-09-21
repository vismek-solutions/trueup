---
title: Sibling directories
description: One rule keeps a row of look-alike directories from reaching into each other.
claims:
  - no-sibling-directory-reaches-another
  - no-file-sits-loose-beside-a-group
---

Picture a directory for each route in your app: src/routes/catalog, src/routes/checkout, src/routes/account. What you want from them is easy to say. None of these knows about any other.

Saying it in full is the tedious part. A zone is a name you give to a group of files, chosen by where the files sit. A boundary is a note saying which zones a zone is allowed to reach.

Written out that way, the rule above needs one zone and one boundary per route. That is fine for a handful of directories. It does not scale when the directories are many, alike, and added to constantly.

Then there is the route someone adds tomorrow. Nothing governs it until a person remembers to go and write a zone for it.

## Declaring a group

One line describes the shape instead:

```ts
isolate: [{ siblings: "src/routes/*", except: ["_shared"] }]
```

The star is what names the group, and every directory it matches becomes an island. The except list holds directory names rather than paths, so _shared above means src/routes/_shared.

That line goes in a rulebook that still declares zones, because every file in your project has to land in one. A whole file with nothing else in it looks like this:

```ts
export default defineConfig({
  zones: [{ name: "routes", patterns: ["src/routes/**"] }],
  isolate: [{ siblings: "src/routes/*", except: ["_shared"] }],
});
```

Files inside an island may import each other freely, and they may reach anything outside the group. What they may not do is reach a sibling.

This check runs on its own, alongside your [boundaries](/concepts/boundaries/), and both have to pass. So when this page says an island may reach anything outside the group, it means this check raises no objection. Another rule still might.

A new directory is isolated the moment it exists, with no config change.

## What it reports

```
no-sibling-directory-reaches-another        2 errors
    src/routes/account/orders/history.ts:1:10  is account and may not reach sibling catalog: price from src/routes/catalog/price.ts
    src/routes/checkout/page.ts:1:10  is checkout and may not reach sibling catalog: price from src/routes/catalog/price.ts
```

Depth does not matter. A file at src/routes/account/orders/history.ts still counts as account.

The parent directory itself is in no group, so a file at src/routes/index.ts may import every route and nothing is reported. Holding the group together is what a parent is for, and [wiring](#files-that-sit-beside-the-group) is how you say which files are allowed to sit there.

One import in that run raised nothing at all. The catalog route reaches into _shared/money.ts, and the except list had taken _shared out of the group.

More than one star is allowed, and each combination is its own island. A pattern like apps/*/src/routes/* keeps ui/catalog apart from ui/checkout and from web/catalog, in every app at once.

A second rule one level down keeps the parts inside each route apart the same way. That pattern also reaches into the shared directory, so its subdirectories would become islands too. A negated group leaves those out. Written this way, the star after it only ever names something inside a route, and the shared directory keeps whatever layout it likes:

```ts
isolate: [
  { siblings: "src/routes/*", except: ["_shared"] },
  { siblings: "src/routes/!(_*)/*", except: ["_shared"] },
]
```

:::note
If the pattern matches no directory at all, that is an error rather than a quiet pass. A rule that guards nothing is the failure this tool exists to prevent.
:::

## Files that sit beside the group

A file sitting directly in src/routes belongs to no island, so nothing above governs it. It may reach into every route and this check stays quiet. That is right for the index file, whose job is the group. It is not what you want for a helper that ended up there because nobody decided where it went.

The wiring list says which files may sit there. Writing it down is what turns this question on.

```ts
isolate: [{ siblings: "src/routes/*", except: ["_shared"], wiring: ["**/index.ts"] }]
```

```
no-file-sits-loose-beside-a-group           2 errors
    src/routes/formatMoney.ts  sits beside the siblings `src/routes/*` rather than in one of them
    src/routes/orderStatus.ts  sits beside the siblings `src/routes/*` rather than in one of them
```

Move each one into the route that uses it. If several routes use it, move it out of the parent entirely.

The index file went unreported because the pattern covers it, and every later file that follows the same convention is covered too. Name the convention rather than the instances.

Leave wiring out and nothing is reported. The claim is not made at all, so adding this rule to a project you already have changes nothing until you decide to ask the question. To ask it with nothing excused, give wiring an empty list.

In a workspace, one package can keep its own rulebook, which is the config file holding that package's rules. There, the wiring pattern is read against the package's own directory, the same way the siblings pattern is.

## Asking one file where it stands

A run reports the imports that already exist. To ask before writing one, name the file:

```sh
npx trueup explain src/routes/account/orders/history.ts
```

```
zone        app
may reach   app
may not     none

siblings    account, which `src/routes/*` keeps apart from catalog · checkout
            it may still reach _shared, which the group shares
```

The zone answer and the siblings answer are separate questions, and both bind. Every route here sits in the same zone, so the zone lines on their own would have said this file may reach anything it can see.

A file beside the group gets one line instead, and which line depends on whether the wiring list covers it.

```
siblings    sits beside `src/routes/*` rather than in one of its parts
```

```
siblings    assembles `src/routes/*`, so it may reach every part of it
```

## An order among the shared directories

A group often shares more than one directory. Routes may all reach _shared for helpers and _state for what they hold between visits. Listed as names, those two may reach each other freely, so _state importing a helper is never reported.

To say which shared directory stands below which, write the entry as an object. Its allow list names the shared siblings it may reach, as patterns, the same way the except list names the shared ones.

```ts
isolate: [{ siblings: "src/routes/*", except: ["_shared", { shared: "_state", allow: [] }] }]
```

Now _state reaches no other shared directory, while _shared, still a bare name, reaches every one of them. The routes reach both as before. The list says what a shared directory reaches, never who may reach it.

```
no-sibling-directory-reaches-another        1 error
    src/routes/_state/store.ts:1:10  is _state, shared with no reach into what else is shared, and may not reach _shared: money from src/routes/_shared/money.ts
```

The explain command shows the same order from the file's side.

```
siblings    _state, which `src/routes/*` keeps apart from account · catalog · checkout
            it may not reach _shared, though the group shares it
```

When a directory matches more than one entry, the first one wins, as with zones. Put a narrow object entry before a wide pattern, or the wide pattern quietly gives it the full reach.

A finding here means the code stands against the order you wrote. Move the reaching code down into the directory it reached, or up into one allowed to reach both. Adding the reached directory to the allow list makes the finding go away and leaves the order as it was.

## When to add an exception

The except list is for the directory the group is meant to share. Use it for something like _shared and little else.

When a run says one route reached into another, please do not add the reached-into route to the except list. The finding goes away and the tangle stays where it was. The shared directory is usually the answer to a finding rather than an exception to it, so move the shared code there instead.

The wiring list is the same bargain in the other direction. It is for a file that assembles the group, not for one you have not found a home for yet.

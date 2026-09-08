---
title: Monorepos
description: The root names its members. Each member names its own zones and what it may reach.
---

A monorepo does not need one file listing every zone in every package. The root names its members. Each member names its own zones and what it reaches.

```ts
// trueup.config.ts
export default defineConfig({
  members: ["packages/*", "apps/*"],
});
```

## Starting from the workspace

`trueup init` reads `pnpm-workspace.yaml`, or `workspaces` in `package.json`, and writes that root config plus a rulebook for every package it finds.

```
wrote trueup.config.ts
wrote apps/web/trueup.config.ts
wrote packages/lib/trueup.config.ts
wrote packages/ui/trueup.config.ts

members   packages/* · apps/*
runners   oxlintRunner, over packages · apps only

no zone   e2e
          source no member claims; give it zones in the root config, or it fails as
          unclassified and your linters never see it
```

A package that already has a rulebook keeps it, and is listed as `kept`. A package holding no code yet gets one anyway and is named under `no source` — its zones then match nothing, which is an error rather than a silence.

The `no zone` block is the one to act on first. `init` cannot know what `e2e/` is, so it writes no zone for it, but it walked the tree and can see the code is there. Everything it names will fail as unclassified on the first run, and your linters will not see it either, since the runners cover what the zones cover.

Each member rulebook comes out with its zones and its `allow`:

```ts
// apps/web/trueup.config.ts
export default defineMember({
  allow: ["lib"],
  zones: [
    { name: "pages", patterns: ["src/pages/**"] },
    { name: "evals", patterns: ["evals/**"] },
    { name: "app", patterns: ["**"] },
  ],
});
```

`allow` is seeded from the workspace dependencies the package already declares, so the first run does not open with one error per cross-package import. It is a starting point, not a derivation — the line is in the rulebook, the guard protects it, and a diff shows it changing. [`every-grant-has-a-dependency`](#a-grant-with-no-dependency) is what keeps it honest afterwards.

A package whose `package.json` names its barrel in `exports` gets that barrel as a `role: "api"` zone, so a grant opens the front door rather than the whole package:

```ts
// packages/lib/trueup.config.ts
export default defineMember({
  zones: [
    { name: "api", patterns: ["src/index.ts", "src/vet/index.ts"], role: "api" },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "vet", patterns: ["src/vet/**"] },
  ],
});
```

A subpath pointing at build output is skipped, because `init` only writes a door onto a file it actually found in the tree.

The workspace file is read once, here, and never again. `members` is not derived from it at check time, because the two lists are allowed to disagree — a docs app can be a workspace package and still be governed by a zone in the root config rather than being a member. Nothing is lost by that: with `include` left out, a package no member claims still fails as unclassified. What `init` writes is a draft you own.

Leave `include` out. The whole repository is then analysed, so a directory no member claims fails as unclassified instead of going quietly unchecked. Narrowing `include` is how you *stop* seeing something.

```ts
// packages/lib/trueup.config.ts
export default defineMember({
  zones: [
    { name: "api", patterns: ["src/index.ts"], role: "api" },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "engine", patterns: ["src/engine/**"] },
  ],
  boundaries: [{ from: "domain", allow: [] }],
});
```

A member's patterns are relative to the member. Its zone names are qualified with it, so `lib/domain` and `ui/domain` are different zones even though both packages called theirs `domain`.

A member may only constrain itself. Everything it names is its own — and the rule runs the other way too: an internal boundary judges only edges that land *inside* the package, so it can never revoke a door another member opened. `boundaries: [{ from: "domain", allow: [] }]` means "domain reaches nothing else in this package", not "domain reaches nothing at all". What the package may reach outside itself is `allow`'s business, one line up.

It has to work that way rather than by listing the doors in the rule. An internal rule is anchored on the declaring file, because piercing barrels inside the package is the whole point — and a door is a re-exporter, so a declaring-file anchor resolves straight past it to the file behind. A rule that named the door could never match one.

Being silent rather than forbidding is what `trueup explain` reports too. A zone the internal rule says nothing about stays under `may reach` if another rule allows it, so the answer an agent gets before writing a file is the same answer the check gives after.

## What a member may reach

Nothing, until it says so. A member reaching another it did not name is an error.

```ts
// apps/web/trueup.config.ts
export default defineMember({
  allow: ["lib"],
  zones: [{ name: "pages", patterns: ["src/**"] }],
});
```

This is the same shape as a `package.json` dependency list, and for the same reason: adding a dependency is a local edit, next to the code that took it on. Twenty packages need twenty declarations, not four hundred.

`allow: ["lib"]` opens `lib`'s `role: "api"` zones and nothing else. A package with no api zone opens entirely. It is the same `allow` a boundary rule takes, one level up: there it lists zones, here it lists members.

So this file gets one line of the two past the check:

```ts
// apps/web/src/cart.ts
import { formatMoney } from "@shop/lib";
import { isSettled } from "@shop/lib/domain/order";
```

```
every-import-respects-its-zone-boundary     1 error
    apps/web/src/cart.ts:2:10  is web/pages and may not reach lib/domain: isSettled from packages/lib/src/domain/order.ts
```

Zone names are qualified in the finding too, so `web/pages` and `lib/domain` say which package each side is in.

Reaching between members is judged on the module you imported, not on the file that declares the symbol. Inside one package, following the barrel to the declaration is the whole point. Between packages, the api **is** the contract, and what it re-exports is deliberate.

That applies to a root rule naming a member as well, and it is not optional: an api zone is a re-exporter, so declaring-file anchoring walks straight past it and the door could never match. A rule that names a member gets module anchoring, and asking for `anchor: "declaring-file"` on one is refused rather than left to fail silently.

## What the root still decides

A member can grant itself anything, so a member's own word is not a rule. The root writes the prohibitions no member may lift:

```ts
boundaries: [{ from: "web", allow: [] }]
```

Now the import `web` granted itself is refused as well:

```
every-import-respects-its-zone-boundary     2 errors
    apps/web/src/cart.ts:1:10  is web/pages and may not reach lib/api: formatMoney from packages/lib/src/index.ts
    apps/web/src/cart.ts:2:10  is web/pages and may not reach lib/domain: isSettled from packages/lib/src/domain/order.ts
```

Name a member where a zone would go and it expands: as a `from`, to all of its zones; inside `allow`, to its api zones only. A rule about a member governs only its outward reach — its own zones stay reachable from each other, so an empty `allow` isolates the package rather than shattering it.

A root rule can only narrow what a member granted itself, never widen it, because two rules for one zone intersect.

The root is otherwise just `members` plus repo-wide settings. It needs no zones of its own; declare some only for files that sit outside every member.

Each member's config is protected from agent edits exactly like the root's, and no rulebook is ever analysed as source.

## The door is written down twice

`role: "api"` says what other packages may reach. `package.json#exports` says what they can actually import. Nothing keeps them in sync, and drift is silent in both directions, so it is checked.

```
every-api-zone-is-exported                  2 errors
    packages/drifted/package.json  exports ./vet, which no api zone covers
    packages/drifted/package.json  zone drifted/spare is a door that package.json does not export
```

The first refuses imports that resolve perfectly well. The second is the quieter one: a door nobody outside the workspace can walk through, because the file is not published.

It reports only what it can prove. A member with no `package.json` or no `exports` field says nothing about its surface, so neither does the check. A wildcard subpath like `"./features/*"` matches no single zone, and a subpath pointing at build output — `"./dist/index.js"` — names a file the analysis never reads. In each of those the check stays quiet rather than guessing.

To remove the duplication instead of policing it:

```ts
// packages/shared/trueup.config.ts
export default defineMember({
  doorsFromExports: true,
  zones: [{ name: "inside", patterns: ["src/**"] }],
});
```

Every source file named in `exports` goes into a derived `api` zone ahead of your own, so the barrel is the door and the rest of the package sits behind it. One list, so there is nothing left to drift.

This only works where `exports` points at source. A package that publishes build output would derive a door onto a file the analysis never reads, which is why it is off unless you ask for it. Setting it alongside a hand-written api zone is refused rather than merged.

## A grant with no dependency

`allow` and the dependency list overlap, and only one of them is kept honest by the package manager. Delete the last import of a package and the dependency usually goes with it; the grant stays, open, and nothing would refuse an import that walked back through it.

```
every-grant-has-a-dependency                1 error
    packages/web/trueup.config.ts  allows ui, but package.json does not depend on @grants/ui
```

The other direction is already covered elsewhere. Importing a package that is not a dependency is what fallow's [`unlisted-dependencies`](/integrations/linters/) reports, so this claim only looks for the grant nothing backs.

It compares rather than derives, for the reason the door check does: `package.json` is not a rulebook, and reading permission out of it would move boundary-widening out from behind [the guard](/agents/guard/). A member with no `package.json`, or one depending on no package in the workspace, is wired some other way — nothing is said about its grants.

## Rules that belong to one package

A member takes `seams`, `rules` and `maxFilesPerDirectory` as well. A rule about one package's components means nothing to the server beside it, and putting it in the root config rebuilds the single shared rulebook that `members` exists to break up.

```ts
// apps/web/trueup.config.ts
export default defineMember({
  maxFilesPerDirectory: 30,
  zones: [
    { name: "model", patterns: ["src/model/**"] },
    { name: "view", patterns: ["src/view/**"] },
  ],
  seams: [{ generic: "view", domain: ["model"] }],
  rules: [
    defineRule("one-declaration-per-file", (project) =>
      project.files
        .filter((file) => project.declarationsIn(file).length > 1)
        .map((file) => ({ message: `${project.relative(file)} declares more than one thing`, file })),
    ),
  ],
});
```

A member's rule sees a project narrowed to that member: its own files, and its own zone names unqualified. It is written exactly as it would be if the package stood alone, and it never names the package it lives in — which matters, because a member's name comes from its directory, so a rule that spelled out `web/view` would quietly match nothing the day the folder moved.

The finding is qualified on the way out, so two packages can hold a rule of the same name.

```
web/one-declaration-per-file                1 error
    apps/web/src/view/chip.ts  apps/web/src/view/chip.ts declares more than one thing
```

Because the view is narrowed, a member's rule cannot report on another package. A rule that spans packages is a rule about more than one of them, so it belongs in the root config, where it gets the whole project and the qualified names to go with it.

`duplication` stays root-only. It compares declarations across the whole repository, so a pair that spans two packages with different thresholds has no answer, and inventing one would be worse than the friction of a single number.

## Members are not islands

[Sibling isolation](/checks/isolation/) solves a different problem and members do not replace it. A member is a unit with a rulebook and a public api, and it names what it reaches. An island has neither. There are dozens of them, and the set changes every week, so the value is that a new one is governed the moment it exists.

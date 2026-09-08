---
title: Boundaries
description: Which zones may reach which, anchored on the file that declares a symbol rather than the module you imported.
---

A boundary names a zone, and the zones it may reach.

```ts
boundaries: [{ from: "engine", allow: ["shared"] }]
```

Anything not listed is refused. A zone may always reach itself, so it never has to name itself, and a zone with no boundary at all is unrestricted — allowlists are opt-in, one zone at a time.

That default is what makes them worth writing. Under a denylist a new zone is reachable from everywhere until someone remembers to forbid it. Under an allowlist it is reachable from nowhere until someone says otherwise, and the tool tells you which rule to add.

Two rules for the same zone narrow each other rather than widening: a zone may reach what *every* rule for it allows. That is how a monorepo root overrides what a package granted itself, with no precedence machinery.

## Why barrels break other tools

This is the part that makes `trueline` different from every other tool of its kind.

Most projects have a **barrel**: a file, usually `index.ts`, that re-exports everything around it so consumers can import from one place. `import { Warrant } from "@app/shared"` beats a path six directories deep.

Barrels also make dependency rules useless. To a tool that reads import statements, every consumer of that package looks identical — they all import from `shared/index.ts`. A rule saying "components may not touch warrants" then matches all of those imports or none of them. Neither is the truth.

`trueline` follows the re-export chain to the file that actually **declares** the thing you imported, and anchors the rule there.

On a real monorepo, the same rule written both ways:

| anchored on | result |
|---|---|
| the file that declares the symbol | the four component files that reach `warrants.ts` |
| the module the import statement named | nothing at all |

The second row is where import-graph tools sit. That includes ones which resolve the barrel perfectly well. Resolving it is not the hard part. Attaching the rule to the symbol is.

There is one deliberate exception. [Between packages in a monorepo](/concepts/monorepos/#what-a-member-may-reach) the rule is anchored on the module instead, because there a package's public entry point *is* its contract and what it chooses to re-export is deliberate.

## Two options on a boundary

`anchor: "imported-module"` gives you the blunt version — "this package is off limits entirely". Leave it alone for anything finer.

`ignoreTypeOnly: true` exempts `import type`. Use it when you care that runtime code crossed, rather than that a type name did.

## Zones that depend on each other

This one holds whether or not you wrote a boundary, and takes no configuration.

If `catalog` imports from `checkout` and `checkout` imports back from `catalog`, neither can be read, tested, moved or deleted on its own. The same defect closes the long way round, through a third zone or a fourth, where no pair of zones looks wrong on its own.

```
no-zones-form-a-cycle                     2 errors
    zones catalog and checkout form an import cycle
    zones billing, invoice and ledger form an import cycle
```

Each tangle is reported once, not once per zone in it.

Boundaries cannot say this. You would need a rule for every pair of zones, written out by hand, and the pair that traps you is the one you did not predict. Adding a boundary afterwards does not break a cycle either — the imports have to change.

## Imports your build tool supplies

Frameworks invent specifiers that exist only at build time. `astro:content` is not on disk and never will be, so it fails `every-import-resolves` like any typo would.

Name them and they become external instead:

If every import in your project resolves, you do not need this. Plain Vite, Next and Express projects normally do — path aliases from `tsconfig.json` are followed automatically, and imports of stylesheets, images and JSON are counted as external rather than reported. This is for specifiers that exist only inside a build, which have no file anywhere.

```ts
externals: ["astro:*", "virtual:*", "#imports"]
```

`*` matches any run of characters, slashes included — these are specifiers, not paths, so `virtual:*` covers `virtual:site/heading`.

Nothing relative or absolute can be declared external. A pattern that would swallow `./thing.ts` is ignored for that import, so the escape valve can never hide your own files.

:::caution
Do not reach for the baseline here. A virtual specifier fails on every run, so baselining it buries the check permanently — and the next real typo lands in the same silence.
:::

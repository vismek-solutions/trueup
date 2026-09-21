---
title: Boundaries
description: A boundary says which zones a zone may reach, anchored on the file where a name is really written.
claims:
  - every-import-respects-its-zone-boundary
  - no-zones-form-a-cycle
---

A boundary is a note saying which zones a zone is allowed to reach. A zone, in case you have arrived here first, is a name you give to a group of files, chosen by where the files sit.

```ts
boundaries: [{ from: "engine", allow: ["shared"] }]
```

That says the engine may reach shared. Anything you leave off the list is refused. A zone may always reach itself, so it never has to name itself. A zone with no boundary at all is left unrestricted, which means you can add these one zone at a time.

There are two ways to write a rule like this. You can list what is forbidden, and then a new zone is reachable from everywhere until someone remembers to forbid it. Or you can list what is allowed, which is what these are: a new zone is reachable from nowhere until someone says otherwise. The tool tells you which rule to add.

You may write more than one rule for the same zone. When you do, the zone may reach only what every one of those rules allows. That is how a monorepo root narrows what a package granted itself.

## Why barrels break other tools

This is the point where trueup and a tool that reads import statements give different answers about the same code.

Most projects have a barrel: a file, usually index.ts, that re-exports its neighbours so people can import from one place. That beats a path six directories deep:

```ts
import { Warrant } from "@app/shared"
```

The convenience has a cost. To a tool that reads import statements, every consumer of that package looks identical, because they all import from shared/index.ts, the barrel. A rule saying that components may not touch warrants then matches all of those imports or none of them. Neither of those is the truth.

This is the part people find surprising, so here it is slowly. The tool follows the chain of re-exports back to the declaring file, which is where the thing you imported is actually written. The rule is anchored there. The import statement told it where to start looking, not what the rule is about.

On a real monorepo, the same rule written both ways:

| anchored on | result |
|---|---|
| the file that declares the symbol | the four component files that reach `warrants.ts` |
| the module the import statement named | nothing at all |

The second row is where import-graph tools sit, including the ones that resolve the barrel perfectly well. Resolving it is not the hard part. Attaching the rule to the symbol is.

There is one place where this is turned around on purpose. [Between packages in a monorepo](/concepts/monorepos/#what-a-member-may-reach) the rule is anchored on the module instead. There a package's public entry point is its contract, and what it chooses to re-export is deliberate.

## Two options on a boundary

```ts
boundaries: [
  { from: "components", allow: ["hooks"], ignoreTypeOnly: true },
  { from: "app", allow: ["api"], anchor: "imported-module" },
]
```

The first, ignoreTypeOnly, lets an import through when it brings in nothing but a type. Sometimes you only care that real running code crossed a line, not that a type name did. A component that mentions an order type in a function signature costs nothing when the program runs. A component that calls a function from your business rules does. This setting excuses the first kind and keeps checking the second.

The second sets the anchor to the imported module, which puts the rule back on the module the import statement named. That is the blunt version: this package is off limits entirely, barrel and all. Use it for a third-party package, or for a sibling app you want sealed off. For anything finer, leave it alone, because the finer behaviour is what the section above is about.

## Zones that depend on each other

This check holds whether or not you wrote a single boundary, and it takes no configuration.

Say catalog imports from checkout, and checkout imports back from catalog. Now neither one can be read, tested, moved or deleted on its own. The same tangle can close the long way round, through a third zone or a fourth, where no single pair of them looks wrong.

```
no-zones-form-a-cycle                     2 errors
    zones catalog and checkout form an import cycle
    zones billing, invoice and ledger form an import cycle
```

Each tangle is reported once, not once per zone caught in it.

Boundaries cannot say this for you. You would need a rule for every pair of zones, written out by hand, and the pair that traps you is the one you did not predict. Adding a boundary afterwards does not break a cycle either. The imports themselves have to change.

## Traffic no rule refuses

Boundaries are opt in, one zone at a time, and that has a quiet cost. A pair of zones nobody has written a rule about passes every run, and it passes for the same reason whether you meant it or not.

This asks which pairs those are:

```sh
npx trueup explain --ungoverned
```

The answer sorts every pair of zones into three lists, heaviest traffic first. Pairs no rule refuses come first, and they are the ones to read: a heavy pair there is either the architecture nobody wrote down, or a hole nobody noticed. Only looking tells you which. Then come the pairs some rule permits, where somebody did decide. Last are the pairs with no traffic between them at all.

Nothing here is a violation. It is a reading list for the day you sit down to write the boundaries you have been putting off.

## Imports your build tool supplies

Frameworks invent import names that exist only at build time. The name astro:content is not on disk and never will be, so it fails every-import-resolves the way any typo would.

Name it here and it counts as external instead, meaning it comes from outside your code and is not expected to resolve to a file.

```ts
externals: ["astro:*", "virtual:*", "#imports"]
```

Most projects need none of this. Path aliases from tsconfig.json are followed automatically, and stylesheets, images and JSON already count as external. This list is only for names the build invents, which have no file anywhere.

A star matches any run of characters, slashes included. These are import names rather than paths, so a pattern ending in a star, such as virtual:*, covers virtual:site/heading too.

Nothing relative or absolute can be declared external. A pattern wide enough to swallow a file of your own is ignored for that import, so this escape valve can never hide your own files.

:::caution
Please do not reach for the baseline here. A baseline is the recorded list of problems you have agreed to live with for now. A name the build invents fails on every run, so baselining it buries the check permanently. The next real typo then lands in the same silence.
:::

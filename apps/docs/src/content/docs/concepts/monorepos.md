---
title: Monorepos
description: The root config names your packages, and each package names its own zones and what it may reach.
claims:
  - every-api-zone-is-exported
  - every-grant-has-a-dependency
---

A package is a folder of code with its own package.json file. A workspace is a repository that holds several of those packages side by side, so your package manager can treat them as one project.

A monorepo does not need one file listing every zone in every package, and trueup will not ask you for one. The root config names the packages. Each package then names its own zones and what it reaches.

```ts
// trueup.config.ts
export default defineConfig({
  members: ["packages/*", "apps/*"],
});
```

A package named there is a member: one package inside the workspace that keeps its own rules, in its own file, beside its own code.

## Starting from the workspace

You do not have to write those files yourself. Run trueup init and it reads pnpm-workspace.yaml, or the workspaces field in package.json, and writes the root config plus a rulebook for every package it finds. A rulebook is the config file holding the rules, whether it sits at the root or inside one package.

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

Two more labels can appear in that output. A package that already has a rulebook keeps it and is listed as kept. A package holding no code yet gets a rulebook anyway and is named under no source. Its zones then match nothing, and that is reported as an error rather than passing in silence.

The block headed no zone is the one to act on first. init cannot know what the e2e directory is, so it writes no zone for it, but it did walk the tree and it can see the code is there. Everything named in that block will fail on the first run as unclassified, which means no zone claimed it. Your linters will not see those files either. A runner is the bit of setup that hands a job to a linter you already use, and it covers what the zones cover.

## What init writes for each package

Each member rulebook comes out with its zones and its allow list:

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

The allow list is seeded from the workspace dependencies the package already declares, so your first run does not open with one error per cross-package import. It is a starting point rather than a derivation. The line sits in your rulebook, a diff shows it changing, and the guard protects it. The guard is the part of trueup that looks at an edit before it is saved and can refuse it. [every-grant-has-a-dependency](#a-grant-with-no-dependency) is what keeps the list honest afterwards.

Most packages have a barrel: a file that re-exports its neighbours so everything can be imported from one place. A package whose package.json names its barrel in exports gets that barrel as an api zone. That zone is the package's door, so a grant opens it rather than the whole package.

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

A subpath pointing at build output is skipped, because init only writes a door onto a file it actually found in the tree.

A package with no api zone has no door, so a grant opens all of it. Declaring the first one is therefore not a local edit. Everything else in that package closes at the same moment, and any package that was reaching past it starts failing:

```
every-import-respects-its-zone-boundary  1 error
    packages/app/src/spec.ts:1:10  is app/specs and may not reach lib/routes: home from packages/lib/src/routes/home.ts
```

That is what a door is for, and it is worth knowing before you add one to a package others already import. The errors land in their files rather than in the rulebook you edited, so the cause and the effect sit in different packages. The remedy printed under the finding names the door, because the rule that refused the import came from the package on the other side.

## The workspace file is read once

After that, the workspace file is never read again. The members list is not derived from it when a check runs, because the two lists are allowed to disagree. A docs app can be a workspace package and still be governed by a zone in the root config instead of being a member. What init writes is a draft, and it is yours.

So please leave include out. The whole repository is then analysed, and a package no member claims fails as unclassified instead of going quietly unchecked. Narrowing include is how you *stop* seeing something.

## A member only constrains itself

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

A member's patterns are relative to the member. Its zone names are qualified with it, so lib/domain and ui/domain are two different zones even though both packages called theirs domain.

An internal boundary judges only the edges that land inside the package, where an edge is one name imported by one file. The empty allow list above says that domain reaches nothing else in this package. It says nothing about what domain reaches outside the package, and it cannot close a door another member opened. That is the job of the member's own allow list, one level up.

Inside a package the rule is anchored on the declaring file, so it reaches through the barrels instead of stopping at them.

Run trueup explain and you get the same silence back. A zone the internal rule says nothing about stays under may reach, as long as another rule allows it. So a coding assistant that runs explain before writing a file is told the same thing the check will say afterwards.

## What a member may reach

Nothing, until it says so. A member reaching another member it did not name is an error.

```ts
// apps/web/trueup.config.ts
export default defineMember({
  allow: ["lib"],
  zones: [{ name: "pages", patterns: ["src/**"] }],
});
```

This is the same shape as a dependency list in package.json, and for the same reason: adding a dependency is a local edit, made next to the code that took it on. Twenty packages need twenty declarations, not four hundred.

Naming lib there opens lib's api zones and nothing else. A package with no api zone opens entirely. It is the same allow a boundary rule takes, one level up. There it lists zones, here it lists members.

So one of the two imports in this file gets past the check, and one does not.

```ts
// apps/web/src/cart.ts
import { formatMoney } from "@shop/lib";
import { isSettled } from "@shop/lib/domain/order";
```

```
every-import-respects-its-zone-boundary     1 error
    apps/web/src/cart.ts:2:10  is web/pages and may not reach lib/domain: isSettled from packages/lib/src/domain/order.ts
```

Zone names are qualified in the finding too, so web/pages and lib/domain each say which package that side of the import is in.

Reaching between members is judged on the module you imported, not on the file that declares the symbol. Inside one package, following the barrel to the declaration is the whole point. Between packages, the api is the contract itself, and what it re-exports is deliberate.

That applies to a root rule naming a member as well, and it is not optional. An api zone is a re-exporter, so declaring-file anchoring walks straight past it and the door could never match. A rule that names a member gets module anchoring, and asking for declaring-file anchoring on one is refused rather than left to fail quietly.

## What the root still decides

A member can grant itself anything, so a member's own word is not a rule. The root writes the prohibitions no member may lift:

```ts
boundaries: [{ from: "web", allow: [] }]
```

Now the import that web granted itself is refused as well:

```
every-import-respects-its-zone-boundary     2 errors
    apps/web/src/cart.ts:1:10  is web/pages and may not reach lib/api: formatMoney from packages/lib/src/index.ts
    apps/web/src/cart.ts:2:10  is web/pages and may not reach lib/domain: isSettled from packages/lib/src/domain/order.ts
```

You can name a member anywhere a zone would go, and it expands. Used as the from of a rule it stands for all of that member's zones. Inside an allow list it stands for its api zones only. A rule about a member governs only its outward reach, so its own zones stay reachable from each other, and an empty allow list isolates the package rather than shattering it.

A root rule can only narrow what a member granted itself, never widen it, because two rules for one zone intersect.

Beyond that, the root holds the members list and the settings that apply to the whole repository. It needs no zones of its own. Declare some only for files that sit outside every member.

Each member's config is protected from agent edits exactly like the root's, and no rulebook is ever analysed as source.

## The door is written down twice

A zone marked with the api role says what other packages may reach. The exports field in package.json says what they can actually import. Nothing keeps the two in sync, and drift is silent in both directions, so trueup checks it. That check is a claim: one sentence trueup believes about your project, which every run proves or disproves.

```
every-api-zone-is-exported                  3 errors
    packages/drifted/package.json  exports ./vet, which no api zone covers
    packages/drifted/package.json  zone drifted/spare is a door that package.json does not export
    packages/widened/package.json  zone widened/api covers packages/widened/src/warrants.ts, which package.json does not export
```

The first finding is about imports that resolve perfectly well and are refused all the same. The second is a door nobody outside the workspace can walk through, because the file is not published.

The third is the one worth understanding, because it is how a package quietly comes open. Widening an api zone by one pattern is not a local edit. An api zone is what an allow list opens, so every package you invited in can now reach that file directly, past the barrel, while nothing outside the workspace can import it at all. That is why the check is per file rather than per zone. A door that covers one exported file does not get to carry any others in with it.

It reports only what it can prove. A member with no package.json, or none with an exports field, says nothing about its surface, so neither does the check. A wildcard subpath such as ./features/* matches no single zone. A subpath pointing at build output, such as ./dist/index.js, names a file the analysis never reads. In each of those the check stays quiet rather than guessing.

You can also remove the duplication instead of policing it:

```ts
// packages/shared/trueup.config.ts
export default defineMember({
  doorsFromExports: true,
  zones: [{ name: "inside", patterns: ["src/**"] }],
});
```

Every source file named in exports goes into a derived api zone ahead of your own, so the barrel is the door and the rest of the package sits behind it. One list, so there is nothing left to drift.

This only works where exports points at source. A package that publishes build output would derive a door onto a file the analysis never reads, which is why the setting is off unless you ask for it. Setting it alongside a hand-written api zone is refused rather than merged.

## A grant with no dependency

An allow list and a dependency list overlap, and only one of them is kept honest by your package manager. Delete the last import of a package and the dependency usually goes with it. The grant stays, open, and nothing would refuse an import that walked back through it.

```
every-grant-has-a-dependency                1 error
    packages/web/trueup.config.ts  allows ui, but package.json does not depend on @grants/ui
```

The other direction is already covered elsewhere. Importing a package that is not a dependency is what fallow's [unlisted-dependencies](/integrations/linters/) reports, so this claim only looks for the grant that nothing backs.

It compares rather than derives, for the same reason the door check does. A package.json is not a rulebook, and reading permission out of it would move the widening of a boundary out from behind [the guard](/agents/guard/). A member with no package.json, or one depending on no package in the workspace, is wired some other way, and nothing is said about its grants.

## Rules that belong to one package

A member also takes seams, rules and maxFilesPerDirectory. A seam is the line between reusable code and code that knows your business. A rule about one package's components means nothing to the server beside it, and putting it in the root config rebuilds the single shared rulebook that the members list exists to break up.

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

A member's rule sees a project narrowed to that member: its own files, and its own zone names unqualified. It is written exactly as it would be if the package stood alone. It never names the package it lives in, and that matters. A member's name comes from its directory, so a rule that spelled out web/view would quietly match nothing the day the folder moved.

The finding is qualified on the way out, so two packages can hold a rule of the same name.

```
web/one-declaration-per-file                1 error
    apps/web/src/view/chip.ts  apps/web/src/view/chip.ts declares more than one thing
```

Because the view is narrowed, a member's rule cannot report on another package. A rule that spans packages is a rule about more than one of them, so it belongs in the root config, where it gets the whole project and the qualified names to go with it.

The duplication check stays root-only. It compares declarations across the whole repository, so a pair that spans two packages with different thresholds has no answer, and inventing one would be worse than the friction of a single number.

## Members are not islands

[Sibling isolation](/checks/isolation/) solves a different problem, and members do not replace it. A member is a unit with a rulebook and a public api, and it names what it reaches. An island has neither. There are dozens of them, and the set changes every week, so the value there is that a new one is governed the moment it exists.

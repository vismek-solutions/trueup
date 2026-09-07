---
title: Monorepos
description: The root names its members. Each member names its own zones and what it may reach.
---

A monorepo does not need one file listing every zone in every package. The root names its members. Each member names its own zones and what it reaches.

```ts
// trueline.config.ts
export default defineConfig({
  members: ["packages/*", "apps/*"],
});
```

No `include` needed. Left out, the whole repo is analysed, so a directory no member claims fails as unclassified rather than going quietly unchecked. Narrowing `include` is how you *stop* seeing something, which is rarely what you want.

```ts
// packages/lib/trueline.config.ts
export default defineMember({
  zones: [
    { name: "api", patterns: ["src/index.ts"], role: "api" },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "engine", patterns: ["src/engine/**"] },
  ],
  boundaries: [{ from: "domain", mayNotReach: ["engine"] }],
});
```

A member's patterns are relative to the member. Its zone names are qualified with it, so `lib/domain` and `ui/domain` are different zones even though both packages called theirs `domain`.

A member may only constrain itself. Everything it names is its own.

## What a member may reach

Nothing, until it says so. A member reaching another it did not name is an error.

```ts
// apps/web/trueline.config.ts
export default defineMember({
  mayReach: ["lib", "ui"],
  zones: [{ name: "pages", patterns: ["src/**"] }],
});
```

This is the same shape as a `package.json` dependency list, and for the same reason: adding a dependency is a local edit, next to the code that took it on. Twenty packages need twenty declarations, not four hundred.

`mayReach: ["lib"]` opens `lib`'s `role: "api"` zones and nothing else. A package with no api zone opens entirely.

Reaching between members is judged on the module you imported, not on the file that declares the symbol. Inside one package, following the barrel to the declaration is the whole point. Between packages, the api **is** the contract, and what it re-exports is deliberate.

## What the root still decides

A member can grant itself anything, so a member's own word is not a rule. The root writes the prohibitions no member may lift:

```ts
boundaries: [{ from: "apps", mayNotReach: ["apps"] }]
```

Name a member where a zone would go and it expands to that member's zones — minus its api, on the right of `mayNotReach`. A prohibition always wins over a `mayReach`.

The root is otherwise just `members` plus repo-wide settings. It needs no zones of its own; declare some only for files that sit outside every member.

Each member's config is protected from agent edits exactly like the root's, and no rulebook is ever analysed as source.

Still one number for the whole repo: `maxFilesPerDirectory` and `duplication`. Members cannot override those yet.

## Members are not islands

[Sibling isolation](/checks/isolation/) solves a different problem and members do not replace it. A member is a unit with a rulebook and a public api, and it names what it reaches. An island has neither, there are dozens of them, and the set changes every week — the whole value there is that a new one is governed the moment it exists.

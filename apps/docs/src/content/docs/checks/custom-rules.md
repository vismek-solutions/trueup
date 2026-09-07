---
title: Rules you write yourself
description: A plain TypeScript function over the project, with the parser kept out of sight.
---

Config covers direction and vocabulary. Anything else is a plain TypeScript function over the project.

```ts
import { defineRule } from "trueline";

rules: [
  defineRule("domain-is-entered-through-its-index", (project) =>
    project
      .imports({ declaredZone: "domain" })
      .filter((edge) => edge.fromZone !== "domain" && !edge.via.endsWith("domain/index.ts"))
      .map((edge) => ({
        message: `reaches ${edge.imported} without going through the index`,
        file: edge.from,
        at: edge.at,
      })),
  ),
]
```

Each import arrives with its origin zone and its declaring zone already worked out. Alongside those come `via` (the module the import statement named), `symbol` and `kind`.

Return a list of issues. A message alone is enough, and severity defaults to `error`.

## Give the rule a remedy

A third argument says what a violation means and how to fix it. Whoever hits the rule reads that instead of guessing.

```ts
defineRule("domain-is-entered-through-its-index", check,
  "Something reached past the domain's index into a file behind it, which fixes that file's path and name for every caller. Export what the caller needs from the index and import it from there.")
```

A claim without guidance is unfinished. The message says what happened; the guidance says what to do, and — where it matters — names the fix that would make things worse.

## Rules see a model, not a syntax tree

Rules are handed a view of the project rather than an AST. The parser stays an implementation detail you never have to learn, and swapping it never breaks a rule you wrote.

The distinction the model preserves is the one that matters everywhere else in this tool: `via` is the module the specifier named, and the declaring file is where the symbol actually lives. Collapsing those two is what makes a module-level rule blind through a barrel.

## When to write one instead of asking for a feature

Write a rule when the constraint is specific to your project — a naming convention, an entry point everything must go through, a package that may only be imported from one place.

Built-in claims earn their place by being true of many projects, or by needing something a rule cannot reach. Zone cycles are built in for the second reason: the closure over the zone graph is not something a per-edge filter can express.

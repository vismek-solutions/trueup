---
title: Rules you write yourself
description: A plain TypeScript function over the project, with the parser kept out of sight.
---

Config covers direction and vocabulary. Anything else is a plain TypeScript function over the project.

A rule goes in the `rules` key of your config, so the whole file reads:

```ts
import { defineConfig, defineRule } from "trueline";

export default defineConfig({
  zones: [
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "app", patterns: ["src/**"] },
  ],
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
  ],
});
```

Return a list of issues. A message alone is enough; `file` and `at` place the caret, and severity defaults to `error`.

### What an import gives you

`project.imports()` returns every import in the project, or you can narrow it with `{ fromZone, declaredZone, kind }`. Each one carries:

| field | |
|---|---|
| `from` | the importing file |
| `fromZone` | its zone |
| `specifier` | the text as written in the import |
| `via` | the file that specifier resolved to — the barrel, if there is one |
| `viaZone` | that file's zone |
| `imported` | the exported name asked for |
| `local` | the name it was bound to |
| `symbol` | the declared name, where the target is a single symbol |
| `declaredIn` | the file that actually declares it, after re-exports |
| `declaredZone` | that file's zone |
| `kind` | `"value"` or `"type"` |
| `at` | byte offset of the binding, for the caret |

The pair worth understanding is `via` against `declaredIn`. `via` is the module the author named; `declaredIn` is where the thing really lives. Collapsing those two is what makes a module-level rule blind through a barrel.

## Give the rule a remedy

A third argument says what a violation means and how to fix it. Whoever hits the rule reads that instead of guessing.

```ts
defineRule(
  "domain-is-entered-through-its-index",
  (project) => /* the same function as above */,
  "Something reached past the domain's index into a file behind it, which fixes that file's path and name for every caller. Export what the caller needs from the index and import it from there.",
)
```

A claim without guidance is unfinished. The message says what happened; the guidance says what to do, and — where it matters — names the fix that would make things worse.

## Rules see a model, not a syntax tree

Rules are handed a view of the project rather than an AST. The parser stays an implementation detail you never have to learn, and swapping it never breaks a rule you wrote.

Besides `imports()`, a project answers `files`, `zoneNames`, `zoneOf(file)`, `filesIn(zone)`, `exportsOf(file)` and `relative(file)`.

## When to write one instead of asking for a feature

Write a rule when the constraint is specific to your project — a naming convention, an entry point everything must go through, a package that may only be imported from one place.

Built-in claims earn their place by being true of many projects, or by needing something a rule cannot reach. Zone cycles are built in for the second reason: the closure over the zone graph is not something a per-edge filter can express.

# acs

Checks that a TypeScript codebase still has the shape you meant it to have. Imports resolve to the file that *declares* a symbol, so a rule can see through a barrel — and rules you write yourself are TypeScript functions over the resolved graph, not entries in a config format.

## The problem it solves

A shared package exports everything through one `index.ts`. Every consumer imports from `@app/shared`, so every module-level tool sees the same edge: `components → shared/src/index.ts`. A rule saying "components may not touch warrants" matches all of them or none of them.

Follow the re-export chain instead and the picture separates. On a real monorepo, the same rule anchored two ways:

| anchored on | result |
|---|---|
| the declaring file | the four component files that reach `warrants.ts` |
| the module the specifier named | nothing at all |

The second row is where import-graph tools sit, including the ones that resolve the barrel correctly. Resolution is not the hard part — attaching a rule to the symbol is.

## Start

Requires Node 22.18 or newer. Create `architecture.config.ts` at the project root:

```ts
import { defineConfig } from "acs";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "spec", patterns: ["**/*.test.ts"] },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "engine", patterns: ["src/engine/**"] },
    { name: "app", patterns: ["src/**"] },
  ],
  boundaries: [{ from: "engine", mayNotReach: ["domain", "app"] }],
});
```

Then run `acs`:

```
coverage  898 files · 7524 edges · 5816 symbol · 1663 external · 41 builtin · 0 unresolved
zones     spec 274 · domain 39 · engine 102 · app 483 · 0 unclassified

the-analysis-reached-files                  ok
every-import-resolves                       ok
every-imported-name-is-exported             ok
every-imported-name-is-unambiguous          ok
every-file-belongs-to-a-zone                ok
every-zone-has-a-file                       ok
every-zone-pattern-matches-a-file           ok
every-rule-names-a-declared-zone            ok
every-import-respects-its-zone-boundary     1 error
    src/engine/table.ts:14:9  src/engine/table.ts is engine and may not reach domain: Warrant from src/domain/warrant.ts through src/shared/index.ts
    Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its
    declaring file, so a barrel in between does not excuse it. Move the code to a zone that may
    reach the target, or have the target expose what the caller needs through a zone it may reach.
    Run `acs explain <file>` to see what a file may reach. Widening the rule is not the fix.

generic-code-names-no-domain-concept        ok

10 claims · 1 error · 0 warnings
```

Zones match first-match-wins, so order them narrowest first. Put specs in their own zone ahead of everything else; left in a source zone they contribute fixture prose to every vocabulary.

## What it checks

Every claim runs on every pass and the whole report prints, so a run that clears one class of error still tells you whether the rest moved.

| claim | asserts |
|---|---|
| `the-analysis-reached-files` | the run analysed something |
| `every-import-resolves` | no specifier failed to resolve |
| `every-imported-name-is-exported` | every imported name exists in the module it came from |
| `every-imported-name-is-unambiguous` | no name arrives through two star re-exports |
| `every-file-belongs-to-a-zone` | every file matches exactly one zone |
| `every-zone-has-a-file` | no zone is vacuous |
| `every-zone-pattern-matches-a-file` | no pattern is dead |
| `every-rule-names-a-declared-zone` | no rule names a zone that does not exist |
| `every-import-respects-its-zone-boundary` | the boundaries hold |
| `generic-code-names-no-domain-concept` | the seams hold |

The first four fail closed. An unresolved import, a name no module exports, or a config that matches nothing is an error, never a quiet pass — a check that reports success while enforcing nothing is worse than no check.

Each claim carries its own account of what a violation means and how to resolve it, printed under the findings and repeated in the guard's refusal. A reader who has never seen the rule before gets told what to do about it, and told not to widen the rule to make it pass.

## Boundaries

A boundary names an origin zone and the zones it may not reach:

```ts
boundaries: [
  { from: "engine", mayNotReach: ["domain"] },
  { from: "engine", mayNotReach: ["app"], ignoreTypeOnly: true },
]
```

Edges anchor on the declaring file. Set `anchor: "imported-module"` to judge the module the specifier named instead, which is what you want for "this package is off limits entirely" and not what you want for anything finer.

## Seams

A boundary catches an import. It cannot catch a value arriving as a prop, where the receiving file mirrors a shape it may not name and crosses no import at all.

```ts
seams: [{ generic: "engine", domain: ["domain"] }]
```

The vocabulary is derived, not configured: a domain zone owns the names its files export and the string values its sources contain. Generic code mentioning either, with no import to explain it, is naming something it has no right to. A new domain type is covered the moment it exists.

On a real app this found a component hardcoding `"stav"` where the domain exports `REQUISITION_STATUS = "stav"`, and several hardcoding members of enums the domain declares. Tune with `allow` for words the two genuinely share, and `minLiteralLength` for short incidental strings.

## Rules in TypeScript

Config covers direction and vocabulary. Anything else is a function over the project:

```ts
import { defineRule } from "acs";

rules: [
  defineRule("no-two-zones-import-each-other", (project) => {
    const reaches = new Map<string, Set<string>>();
    for (const edge of project.imports()) {
      if (edge.fromZone === null || edge.declaredZone === null) continue;
      if (edge.fromZone === edge.declaredZone) continue;
      reaches.set(edge.fromZone, (reaches.get(edge.fromZone) ?? new Set()).add(edge.declaredZone));
    }

    return [...reaches].flatMap(([zone, targets]) =>
      [...targets]
        .filter((target) => zone < target && reaches.get(target)?.has(zone) === true)
        .map((target) => ({ message: `zones ${zone} and ${target} import each other` })),
    );
  }),
]
```

Each import arrives with its origin zone and declaring zone already resolved, alongside `via` (the module the specifier named), `symbol`, and `kind`. A rule returns issues; a message alone is enough, and severity defaults to `error`.

Pass a third argument to say what a violation means and how to fix it. Whoever hits the rule — a colleague or an agent — reads that instead of guessing:

```ts
defineRule("no-two-zones-import-each-other", check,
  "Two zones import each other, so neither can be understood or moved alone. Decide which owns the shared concept and give the other a one-way dependency on it.")
```

Rules see a project model rather than a syntax tree, so the parser stays an implementation detail.

## Adopting on a codebase that already breaks the rules

Record what is already there, then hold the line:

```
acs --update-baseline
```

New violations fail. Recorded ones print as warnings — visible, not hidden. An entry whose violation is gone exits `2`, so the list shrinks instead of quietly becoming a set of permanent exemptions.

Entries are keyed on the claim, the file and the message, never on a position, so moving a line does not churn the file. A run where nothing was analysed can never be recorded.

## Blocking a bad edit before it lands

`acs guard` reads a `PreToolUse` payload on stdin and answers whether the proposed content would break the architecture. The file does not have to exist yet — the proposal is resolved against the real graph.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "acs guard" }]
      }
    ]
  }
}
```

Only findings on the proposed path block it. Someone else's standing violation is not this edit's problem, and anything already in the baseline does not block either. An unusable payload, a missing config or a path outside the analysed roots all allow — a guard that errors would block every edit rather than the wrong ones.

## Telling an agent about it

```
acs agent-instructions >> CLAUDE.md
```

Prints a block naming the zones, both commands, and the instruction that matters most: fix the code, not the rule. Widening a boundary or recording a violation in the baseline to make a check pass defeats the check, and an agent under pressure to make output green will otherwise do exactly that.

The command written into guidance comes from `command` in the config, so a project installing this as a dependency sets `command: "npx acs"` and every message says the right thing.

## Asking before writing

```
$ acs explain src/engine/newThing.ts

zone        engine
may reach   engine · shared
may not     domain
vocabulary  domain owns names this file may not use:
            Warrant · WarrantKind · warrantKinds
            and values it may not repeat:
            search · testimony
```

A path in no zone is reported as such, which is the answer you want before creating a directory nothing covers.

## Delegating dead code, duplication and complexity

Another analyzer's findings become claims of their own and land in the same baseline:

```ts
import { fallowRunner } from "acs";

runners: [fallowRunner()]
```

The adapter pins the output schema it was written against. An unrecognised schema, unparseable output, a silent tool or a missing binary fails the run rather than reporting nothing found, and a tool that could not run is never recorded in a baseline.

## Exit codes

`0` clean · `1` errors · `2` the baseline holds entries whose violations are gone · `3` no config

## Cost

A full check on a 900-file monorepo takes about a tenth of a second, and the guard about the same including process startup. Identifiers are read only when a seam rule or a custom rule asks for them, so a run without one never builds a syntax tree.

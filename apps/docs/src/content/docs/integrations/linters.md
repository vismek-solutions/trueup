---
title: Using your existing linter alongside it
description: Delegated findings arrive as claims of their own, under one report and one baseline.
---

The rules here cover what a linter cannot express. Everything else is delegated. Those findings join the same report and the same baseline.

```ts
import { eslintRunner } from "trueup";

runners: [eslintRunner()]
```

Four runners are available: `eslintRunner`, `biomeRunner`, `oxlintRunner` and `fallowRunner`. Add only the ones your project already installs — a runner whose binary is missing fails the run rather than reporting nothing. [`trueup init`](/start/getting-started/) wires the ones it finds in your `package.json`, scoped to the directories your zones cover, which is also the setting you want by hand: given a bare `.`, oxlint and biome will lint `node_modules` too.

Each finding's category becomes its own claim, sitting in the report next to the rules from here:

```
every-import-respects-its-zone-boundary     ok
generic-code-names-no-domain-concept        ok
no-zones-form-a-cycle                       ok
every-delegated-tool-ran                    ok
oxlint/eslint/no-unused-vars                2 warnings
    src/api/money.ts:1:7  Variable 'CURRENCY' is declared but never used. Unused variables should start with a '_'.
    src/api/money.ts:4:9  Variable 'rate' is declared but never used. Unused variables should start with a '_'.
    Reported by oxlint, which this project delegates to. Consult oxlint for what the finding means;
    the rules here did not produce it.

13 claims · 0 errors · 2 warnings
```

A claim per category means a baseline entry pins one rule rather than a whole tool. `every-delegated-tool-ran` is the separate claim that the tool started at all.

Each tool runs with your project root as its working directory, and keeps its own severities. A rule you set to `warn` stays a warning here.

Narrow any of them with `categories`. Biome matches by prefix, so `["lint"]` keeps every lint rule and drops formatter and config noise.

`fallowRunner` reads fallow's whole check output except the categories this tool answers itself: unresolved imports and the three boundary categories.

What you get: dead code, dependency and catalog hygiene, cycles, leaked private types, routing and client/server checks, and anything your own rule packs emit.

What you do not: health, security, feature flags and semantic similarity are separate fallow commands, and this runner does not call them.

Some of fallow's rules ship switched **off**, `private-type-leaks` among them. The category still appears in its output, empty, so nothing about the run would look wrong. `fallowRunner` therefore reads fallow's own resolved config and fails when a category it consumes rests on a rule that is off:

```
every-delegated-tool-ran                    1 error
    fallow did not run: these rules are off in fallow's own config, so the categories relying on
    them can never report: private-type-leaks. Turn them on in fallow, or drop the category from
    the runner.
```

Turn them on in fallow's own config:

```json
{ "rules": { "private-type-leaks": "error", "require-suppression-reason": "error" } }
```

## Copy-paste, from fallow

`no-declaration-is-written-twice` compares whole declarations, so it sees a small exact copy and nothing else. Near-miss clones — the same shape written out again in different words — need a clone detector.

```ts
fallowRunner({ duplication: { mode: "weak", minLines: 5, minTokens: 30 } })
```

Off unless you ask for it, and the two answer different questions. Do not lower this one until it sees what the [declaration rule](/checks/duplication/) sees. On this tool's own repository, that setting reports 886 clone groups — 90% of the codebase. Every quieter setting misses a real renamed copy. Run both at their own thresholds.

Each clone group arrives as one finding per instance, sharing a group, so `--next` shows the whole group as one thing to fix.

Expect one class of false positive: two functions with the same shape and different meanings. `weak` mode normalises identifiers, so it cannot tell them apart. Rename them so the next reader can, and baseline the finding.

If you name a category the tool never reports, the run fails. Otherwise a typo in that name would read as "nothing found", and the check would enforce nothing.

## Adapters distrust the tool they wrap

An adapter fails the check when the tool it wraps is silent, missing, misconfigured, unparseable, reports that it analysed nothing, or has switched off a rule the adapter was counting on. None of those is "nothing found", and a tool that could not run is never recorded in a baseline.

The exit codes matter here, because none of them mean what you would guess. eslint exits `1` for "found problems" and saves `2` for a broken config. Biome and oxlint exit `1` whether they found problems or could not read the path at all, so those adapters read a count out of the payload instead of trusting the status.

## oxlint, if you are on TypeScript 7

`@typescript-eslint/parser` refuses to load against TypeScript 7, which takes eslint out of play for TypeScript there. oxlint carries its own parser, needs no TypeScript API, and implements most of the eslint rules — including the ones eslint has and biome does not, like `max-params`.

```ts
oxlintRunner({ paths: ["src"], categories: ["eslint/max-params"] })
```

## Letting biome fix what it can

```ts
biomeRunner({ write: process.env.CI === undefined })
```

Biome applies its safe fixes, and the report keeps only what it could not fix.

This is off by default, and should stay off in CI. A check that rewrites the tree is reporting on code that no longer matches what was committed. The config is TypeScript, so the environment decides.

Biome's unsafe fixes can change behaviour, and stay out of reach of this option. Pass `--unsafe` through `command` if you want them, knowing an agent will not notice a semantic change. `eslintRunner` takes `--fix` the same way.

## Catching a rule the agent silenced

```ts
eslintRunner({ reportSuppressed: true })
```

Every `// eslint-disable-next-line` becomes a finding under `eslint/suppressed/<rule>`, carrying its justification if one was written.

Existing suppressions go in the baseline. A new one fails.

This is the move an agent makes when told to get the build green. Without this it leaves no trace.

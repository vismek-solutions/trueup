---
title: Using your existing linter alongside it
description: Delegated findings arrive as claims of their own, under one report and one baseline.
---

The rules here cover what a linter cannot express. Everything else is delegated. Those findings join the same report and the same baseline.

```ts
import { biomeRunner, eslintRunner, fallowRunner, oxlintRunner } from "trueline";

runners: [eslintRunner(), biomeRunner(), fallowRunner(), oxlintRunner()]
```

Each finding's category becomes its own claim — `eslint/no-unused-vars`, `biome/lint/suspicious/noDoubleEquals`, `fallow/unused_exports`. A baseline entry then pins one rule rather than a whole tool.

Each tool runs with your project root as its working directory, and keeps its own severities. A rule you set to `warn` stays a warning here.

Narrow any of them with `categories`. Biome matches by prefix, so `["lint"]` keeps every lint rule and drops formatter and config noise.

`fallowRunner` reads every category in fallow's check output except the ones this tool answers itself — unresolved imports, and its three boundary categories. So you get its dead code, its dependency and catalog hygiene, its cycles, its leaked private types, its routing and client/server checks, and anything a rule pack of yours emits. Its other analyses — health, security, feature flags, semantic similarity — are separate commands and are not read.

:::caution
Some of fallow's rules ship switched **off**, `private-type-leaks` among them. The category still appears in its output, empty, so the claim here passes while enforcing nothing. Turn those on in fallow's own config:

```json
{ "rules": { "private-type-leaks": "error", "require-suppression-reason": "error" } }
```
:::

## Copy-paste, from fallow

`no-declaration-is-written-twice` compares whole declarations, so it sees a small exact copy and nothing else. Near-miss clones — the same shape written out again in different words — need a clone detector.

```ts
fallowRunner({ duplication: { mode: "weak", minLines: 5, minTokens: 30 } })
```

Off unless you ask for it, and the two answer different questions. Lowering this one until it sees what the [declaration rule](/checks/duplication/) sees does not work: on this tool's repository that setting reports 886 clone groups covering 90% of the codebase, while every quieter setting misses a real renamed copy outright. Run both at their own thresholds.

Each clone group arrives as one finding per instance, sharing a group, so `--next` shows the whole group as one thing to fix.

Expect one class of false positive: two functions with the same shape and different meanings. `weak` mode normalises identifiers, so it cannot tell them apart. Rename them so the next reader can, and baseline the finding.

A category you name that the tool never reports fails the run. Reading it as "nothing found" is how a typo becomes a check that silently enforces nothing.

## Adapters distrust the tool they wrap

Unparseable output. An unexpected shape. A silent tool, a missing binary, a config error, a file the tool could not parse, a run that checked nothing.

Each of those fails the check rather than reporting nothing found. A tool that could not run is never recorded in a baseline.

The exit codes are worth knowing about, because none of them mean what you would guess. eslint exits `1` for "found problems" and saves `2` for a broken config. Biome and oxlint exit `1` whether they found problems or could not read the path at all, so those adapters read a count out of the payload instead of trusting the status.

## A note on oxlint

oxlint is worth knowing about if you are on TypeScript 7. `@typescript-eslint/parser` refuses to load against it, which takes eslint out of play for TypeScript entirely until that lands. oxlint carries its own parser, needs no TypeScript API, and implements most of the eslint rules — including the ones eslint has and biome does not, like `max-params`.

```ts
oxlintRunner({ paths: ["src"], categories: ["eslint/max-params"] })
```

## Letting biome fix what it can

```ts
biomeRunner({ write: process.env.CI === undefined })
```

Biome applies its safe fixes, and the report keeps only what it could not fix. The agent then spends its turns on findings that need judgement instead of on `let` versus `const`.

This is off by default, and worth keeping off in CI. A check that rewrites the tree is reporting on code that no longer matches what was committed. The config is TypeScript, so the environment decides.

Biome's unsafe fixes can change behaviour, and stay out of reach of this option. Pass `--unsafe` through `command` if you want them, knowing an agent will not notice a semantic change. `eslintRunner` takes `--fix` the same way.

## Catching a rule the agent silenced

```ts
eslintRunner({ reportSuppressed: true })
```

Every `// eslint-disable-next-line` becomes a finding under `eslint/suppressed/<rule>`, carrying its justification if one was written.

Existing suppressions go in the baseline. A new one fails.

This is the move an agent makes when told to get the build green. Without this it leaves no trace.

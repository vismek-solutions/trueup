---
title: Keeping the linter you already have
description: trueup hands the ordinary checks to the tools you already run, and reports their findings beside its own.
---

Yes, you can keep it. Nothing here replaces eslint, biome or oxlint.

The rules on this site cover the things a linter has no way to say, such as which parts of your project are allowed to reach which. Everything else is handed to the tool you already have. Its findings come back in the same report, and go in the same baseline, which is the recorded list of problems you have agreed to live with for now.

The piece of setup that hands a job to another tool is called a runner. You add one to your config:

```ts
import { eslintRunner } from "@vismek-solutions/trueup";

runners: [eslintRunner()]
```

Four of them exist, one per tool:

```ts
import { biomeRunner, eslintRunner, fallowRunner, oxlintRunner } from "@vismek-solutions/trueup";
```

Add only the ones your project already installs. A runner whose binary is missing fails the run rather than reporting nothing.

[trueup init](/start/getting-started/) wires up the ones it finds in your package.json, and limits each one to the directories your zones cover. A zone is a name you give to a group of files, chosen by where the files sit. That limit is worth copying if you write the config by hand. Point oxlint or biome at the whole tree instead, and they will lint node_modules along with your code.

## What comes back

Each category of finding becomes a claim of its own. A claim is one sentence trueup believes about your project, and each run either proves it or shows you where it is not true. So the borrowed findings sit in the report next to the rules from here:

```
every-import-respects-its-zone-boundary     ok
generic-code-names-no-domain-concept        ok
no-zones-form-a-cycle                       ok
every-delegated-tool-ran                    ok
oxlint/eslint/no-unused-vars                2 warnings
    src/api/money.ts:1:7  Variable 'CURRENCY' is declared but never used. Unused variables should start with a '_'.
    src/api/money.ts:4:9  Variable 'rate' is declared but never used. Unused variables should start with a '_'.
    ────────
    Reported by oxlint, which this project delegates to. Consult oxlint for what the finding means;
    the rules here did not produce it.

13 claims · 0 errors · 2 warnings
```

A claim per category means a baseline entry pins one rule rather than a whole tool. One claim stands apart from the rest: every-delegated-tool-ran says the tool started at all.

Each tool runs with your project root as its working directory, and keeps its own severities. A rule you set to warn stays a warning here.

You can narrow a runner to the categories you want. Biome matches by prefix, so this keeps every lint rule and leaves out the formatter and config noise:

```ts
biomeRunner({ categories: ["lint"] })
```

## Handing the rest to fallow

fallow is a codebase analyzer. Its runner reads the whole of fallow's check output, except the categories trueup answers itself: unresolved imports and the three boundary categories.

What you get: dead code, dependency and catalog hygiene, cycles, leaked private types, routing and client/server checks, and anything your own rule packs emit.

What you do not: health, security, feature flags and semantic similarity are separate fallow commands, and this runner does not call them.

Some of fallow's rules ship switched **off**. A category resting on one of those still appears in fallow's output, empty, and an empty category prints the same way as a clean one. So the fallow runner reads fallow's own resolved config, and fails when a category it consumes rests on a rule that is off:

```
every-delegated-tool-ran                    1 error
    fallow did not run: these rules are off in fallow's own config, so the categories relying on
    them can never report: private-type-leaks. Turn them on in fallow, or drop the category from
    the runner.
```

The default set leaves out any category resting on a rule fallow ships off, so this does not fire on a fresh project. The one it drops is private-type-leaks, and you reach that failure only by naming that category yourself.

private-type-leaks is worth turning on. Do it in fallow's own config:

```json
{ "rules": { "private-type-leaks": "error", "require-suppression-reason": "error" } }
```

Then ask for the whole set:

```ts
import { FALLOW_CATEGORIES, fallowRunner } from "@vismek-solutions/trueup";

fallowRunner({ categories: [...FALLOW_CATEGORIES] })
```

## Copy-paste, from fallow

The rule named no-declaration-is-written-twice compares whole declarations, so it sees a small exact copy and nothing else. A near-miss clone, the same shape written out again in different words, needs a clone detector. fallow has one:

```ts
fallowRunner({ duplication: { mode: "weak", minLines: 5, minTokens: 30 } })
```

It is off unless you ask for it. The clone detector and the rule here answer different questions.

Please do not lower these numbers until the detector finds what the [declaration rule](/checks/duplication/) finds. On trueup's own repository, a setting that low reports 886 clone groups, which is 90% of the codebase. Every quieter setting misses a real renamed copy. Run both, each at its own threshold.

Each clone group arrives as one finding per instance, and the findings share a group, so the run that shows you one problem at a time shows the whole group as that one problem:

```sh
npx trueup --next
```

Expect one kind of false positive: two functions with the same shape and different meanings. Weak mode normalises identifiers, so it cannot tell them apart. Rename them so the next reader can, then put the finding in the baseline.

## Silence is not the same as nothing found

A runner fails the check when the tool it wraps is silent, missing, misconfigured, unparseable, reports that it analysed nothing, or has switched off a rule the runner was counting on. None of those is "nothing found", and a tool that could not run is never recorded in a baseline.

Naming a category the tool never reports fails the run as well. Otherwise a typo in that name would read as "nothing found", and the check would enforce nothing.

The exit codes matter here, because none of them mean what you would guess. eslint exits 1 for "found problems" and saves 2 for a broken config. Biome and oxlint exit 1 whether they found problems or could not read the path at all, so those two runners read a count out of the payload instead of trusting the status.

## oxlint, if you are on TypeScript 7

The typescript-eslint parser refuses to load against TypeScript 7, which takes eslint out of play for TypeScript there. oxlint carries its own parser, needs no TypeScript API, and implements most of the eslint rules, including ones eslint has and biome does not, like a cap on how many parameters a function takes:

```ts
oxlintRunner({ paths: ["src"], categories: ["eslint/max-params"] })
```

## Letting biome fix what it can

```ts
biomeRunner({ write: process.env.CI === undefined })
```

Biome applies its safe fixes, and the report keeps only what it could not fix.

This is off by default, and should stay off in CI. A check that rewrites the tree is reporting on code that no longer matches what was committed. The config is TypeScript, so the environment can make that decision, the way the line above does.

Biome's unsafe fixes can change what your code does, and this option will not reach them. If you want them, hand biome its own flag through the command option:

```
--unsafe
```

An agent, meaning a coding assistant that writes code in your project, will not notice that the meaning of the code changed. The eslint runner takes its fix flag through the command option in the same way.

## Catching a rule the agent silenced

```ts
eslintRunner({ reportSuppressed: true })
```

Every eslint-disable-next-line comment becomes a finding, filed under eslint/suppressed followed by the name of the rule, and carrying its justification if one was written.

Existing suppressions go in the baseline. A new one fails.

Silencing a rule is what an agent reaches for when it is told to get the build green. Without this, it leaves no trace.

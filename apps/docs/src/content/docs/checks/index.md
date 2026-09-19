---
title: What it checks
description: The full list of what trueup looks for, and what you set up to turn each one on.
claims:
  - the-analysis-reached-files
  - every-import-resolves
  - every-imported-name-is-exported
  - every-imported-name-is-unambiguous
  - every-rule-names-a-declared-zone
  - no-change-outgrows-its-review
---

Everything trueup checks is written as a claim. A claim is one sentence the tool believes about your project, and every run either proves it or disproves it.

Many of the claims talk about zones. A zone is a name you give to a group of files, chosen by where the files sit. You invent the names yourself.

Here is the whole list. Read down the right-hand column to see which ones matter to you.

| claim | what it says |
|---|---|
| `the-analysis-reached-files` | the run found files to look at |
| `every-import-resolves` | every import found the file it names |
| `every-imported-name-is-exported` | every name you imported is really in the module it came from |
| `every-imported-name-is-unambiguous` | no name arrives through two different re-export chains |
| `every-file-belongs-to-a-zone` | every file is claimed by some zone |
| `every-zone-has-a-file` | no zone is empty |
| `every-zone-pattern-matches-a-file` | no pattern is dead |
| `every-rule-names-a-declared-zone` | no rule mentions a zone that does not exist |
| `every-api-zone-is-exported` | a package's api zones and its `package.json` exports agree |
| `every-grant-has-a-dependency` | a package reaches only what its `package.json` depends on |
| `every-import-respects-its-zone-boundary` | every import stays inside the reach its zone was given |
| `no-zones-form-a-cycle` | no group of zones depends on itself |
| `no-sibling-directory-reaches-another` | sibling directories stay independent |
| `generic-code-names-no-domain-concept` | reusable code stays clear of the words your domain owns |
| `no-directory-holds-too-many-files` | no directory has grown past the file count you allow |
| `no-declaration-is-written-twice` | nothing exists in two copies |
| `no-value-is-declared-away-from-its-only-consumer` | nothing sits in one zone when a single file in another is its only user |
| `no-file-serves-two-readerships` | no file holds two sets of exports whose readers never overlap |
| `no-export-exists-only-for-a-test` | nothing is public only so a test can reach it |
| `no-test-reaches-an-internal` | no test is pinned to a split the callers of its subject cannot see |
| `no-file-sits-loose-beside-a-group` | the only file sitting beside a group of directories is the one that assembles it |
| `no-prose-uses-a-banned-mark` | no sentence in your guides uses a mark you banned |
| `no-prose-uses-a-banned-word` | no sentence in your guides uses a word you banned |
| `no-passage-runs-past-its-limit` | no sentence or paragraph is longer than you allow |
| `no-inline-code-holds-more-than-a-path` | inline code holds a path, a command or a symbol, never a phrase |
| `every-link-says-where-it-goes` | no link hides its destination behind words like here or this page |
| `no-change-outgrows-its-review` | no change has grown past the size a person can review |
| `every-delegated-tool-ran` | every other analyzer you configured actually ran |

## Imports are checked by name

Most tools stop as soon as an import points at a file that exists. Two of these claims go one step further. They ask whether the name you imported is really in that file.

Here is a barrel, which is a file that re-exports its neighbours so everyone can import from one place:

```ts
// src/pricing/index.ts
export * from "./net.js";
export * from "./gross.js";
```

Both of those modules export a value called price. So the import below compiles, and there is no telling which of the two you get:

```ts
// src/checkout/total.ts
import { price } from "../pricing/index.js";
```

A run that hits a missing name and an ambiguous one reports them like this:

```
every-imported-name-is-exported             1 error
    src/checkout/receipt.ts:1:10  imports formatPrice from ../pricing/net.js, which does not export it
    ────────
    The module resolved but exports no such name.

    Do this:
    - Correct the import, if the name is wrong.
    - Or restore the re-export it used to travel through, if one was removed.

every-imported-name-is-unambiguous          1 error
    src/checkout/total.ts:1:10  imports price from ../pricing/index.js, which re-exports it from more than one module
    ────────
    Two star re-exports supply the same name, so which one a consumer gets is undefined and no rule
    can say where it came from.

    Do this:
    - Export it from one place.
    - Or re-export it by name rather than through a star.
```

A file written in CommonJS is the exception. Assigning the whole exports object in one statement declares nothing this analysis can list, so its export list counts as unknown rather than empty. A name imported from a file like that is never reported as missing. To say a name is absent, the tool has to have seen the exports first.

An ambiguous name is also why the rest of the run has to stop and say so. Every rule about which files may reach which is anchored on the declaring file: the file where a thing is actually written, once you have followed every re-export. An ambiguous import has two of those. Export the name from one place, or re-export it by name instead of with a star.

## Why a half-blind run is an error

An import that does not resolve. A name no module exports. A zone pattern that matches nothing. Each one means the tool is seeing less of your project than you think it is.

A check that reports success while enforcing nothing is worse than no check at all. It is a gate that keeps passing while the thing it guards drifts. Four architecture tools were measured doing exactly that:

- config globs resolved against the wrong directory, so zero files were checked
- unresolved specifiers marked valid and skipped
- a scope narrowed until the query returned nothing, then reported high confidence

So an empty or degraded input is an error here, never a pass. The coverage line at the top of every report is counted from the run itself. Your config does not get to declare it.

## How big a change can be reviewed

Every other check on this page reads your code. This one reads the size of the change you are about to hand somebody.

```ts
reviewable: { additions: 400, deletions: 400, nearing: 0.8 },
```

The two numbers are the most added lines and the most removed lines one change may carry. Past that, a change gets reviewed by skimming, and skimming is not reviewing.

The finding says how many lines were added and removed, which branch that was measured against, the budget those lines passed, and the three files carrying most of the weight. Going over prints a warning by default. Set the severity to error and it fails the run instead. The nearing value asks to hear about it earlier, so 0.8 speaks up once four fifths of the budget is gone.

The change is measured from where your branch left the base branch, which is main unless you name another. Work you have not committed yet counts too, new files included, because it is still work somebody has to read.

Some files grow without anybody reading them. A lock file, generated output, a vendored copy: name those in the except list rather than raising the numbers.

This claim is never recorded in the baseline. Accepting it once would switch the budget off for good.

## What turns each one on

Nine claims are always on, and they need nothing from you but zones. The rest wait until you add a key to your config:

| key | turns on |
|---|---|
| `boundaries` | `every-import-respects-its-zone-boundary` |
| `isolate` | [`no-sibling-directory-reaches-another`](/checks/isolation/), and [`no-file-sits-loose-beside-a-group`](/checks/isolation/#files-that-sit-beside-the-group) when a rule also sets `wiring` |
| `seams` | [`generic-code-names-no-domain-concept`](/checks/seams/) |
| `maxFilesPerDirectory` | [`no-directory-holds-too-many-files`](/checks/placement/#directory-size) |
| `duplication` | [`no-declaration-is-written-twice`](/checks/duplication/) |
| `colocation` | `no-value-is-declared-away-from-its-only-consumer`, and `no-export-exists-only-for-a-test` when a zone also has `role: "tests"` |
| `readerships` | [`no-file-serves-two-readerships`](/checks/placement/#one-file-answering-to-two-audiences) |
| `testInternals` | [`no-test-reaches-an-internal`](/checks/placement/#tests-that-reach-an-internal) |
| `text` | [one prose claim per key you set under it](/checks/prose/) |
| `reviewable` | [`no-change-outgrows-its-review`](#how-big-a-change-can-be-reviewed) |
| `members` | [`every-api-zone-is-exported`](/concepts/monorepos/#the-door-is-written-down-twice) and [`every-grant-has-a-dependency`](/concepts/monorepos/#a-grant-with-no-dependency), wherever a member's `package.json` says enough to compare |
| `runners` | [one claim per delegated category](/integrations/linters/) |
| `rules` | [whatever you name](/checks/custom-rules/) |

One claim has no key of its own. That is no-zones-form-a-cycle, and it needs no setting up, because there is no version of a zone cycle that anyone wants.

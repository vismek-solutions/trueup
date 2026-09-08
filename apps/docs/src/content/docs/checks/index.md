---
title: What it checks
description: Every claim the tool makes about a project, and which ones fail loudly.
---

| claim | asserts |
|---|---|
| `the-analysis-reached-files` | the run analysed something |
| `every-import-resolves` | no import failed to resolve to a real file |
| `every-imported-name-is-exported` | every imported name exists in the module it came from |
| `every-imported-name-is-unambiguous` | no name arrives through two different re-export chains |
| `every-file-belongs-to-a-zone` | every file is claimed by some zone |
| `every-zone-has-a-file` | no zone is empty |
| `every-zone-pattern-matches-a-file` | no pattern is dead |
| `every-rule-names-a-declared-zone` | no rule mentions a zone that does not exist |
| `every-api-zone-is-exported` | a package's api zones and its `package.json` exports agree |
| `every-import-respects-its-zone-boundary` | the boundaries hold |
| `no-zones-form-a-cycle` | no group of zones depends on itself |
| `no-sibling-directory-reaches-another` | sibling directories stay independent |
| `generic-code-names-no-domain-concept` | the seams hold |
| `no-directory-holds-too-many-files` | no directory has become a drawer |
| `no-declaration-is-written-twice` | nothing exists in two copies |
| `no-value-is-declared-away-from-its-only-consumer` | nothing crosses a boundary for a single caller |
| `no-export-exists-only-for-a-test` | nothing is public just so a test can reach it |
| `every-delegated-tool-ran` | every other analyzer you configured actually ran |

## Imports are checked by name

Most tools stop once a specifier resolves to a file. Two of these claims go one step further and ask whether the *name* you imported is really there.

```ts
// src/pricing/index.ts
export * from "./net.js";
export * from "./gross.js";
```

Both of those modules export `price`. So this import compiles, and which `price` you get is anyone's guess:

```ts
// src/checkout/total.ts
import { price } from "../pricing/index.js";
```

```
every-imported-name-is-exported             1 error
    src/checkout/receipt.ts:1:10  src/checkout/receipt.ts imports formatPrice from ../pricing/net.js, which does not export it
    The module resolved but exports no such name. Either the import is wrong, or a re-export it used
    to travel through was removed.

every-imported-name-is-unambiguous          1 error
    src/checkout/total.ts:1:10  src/checkout/total.ts imports price from ../pricing/index.js, which re-exports it from more than one module
    Two star re-exports supply the same name, so which one a consumer gets is undefined and no rule
    can say where it came from. Export it from one place, or re-export it by name.
```

A CommonJS file is the exception. `module.exports = { … }` declares nothing this analysis can enumerate, so its export list is unknown rather than empty, and a name imported from it is never reported as missing. Claiming absence requires having seen the exports.

Ambiguity is also why the rest of the run has to stop and say so. Every boundary rule here is anchored on the file that *declares* a symbol, and this import has two candidates. Export the name from one place, or re-export it by name instead of with `*`.

## Why the completeness checks are errors

An import that does not resolve, a name no module exports, a zone pattern matching nothing: each means the tool is seeing less than you think it is.

A check that reports success while enforcing nothing is worse than no check at all — it is a gate that keeps passing while the thing it guards drifts. Four architecture tools were measured doing exactly that:

- config globs resolved against the wrong directory, so zero files were checked
- unresolved specifiers marked valid and skipped
- a scope narrowed until the query returned nothing, then reported high confidence

So an empty or degraded input is an error here, never a pass. The coverage line at the top of every report is counted from the run itself, not declared by the config.

## What turns each one on

Nine claims are always on and need nothing but zones. The rest wait for a config key:

| key | turns on |
|---|---|
| `boundaries` | `every-import-respects-its-zone-boundary` |
| `isolate` | [`no-sibling-directory-reaches-another`](/checks/isolation/) |
| `seams` | [`generic-code-names-no-domain-concept`](/checks/seams/) |
| `maxFilesPerDirectory` | [`no-directory-holds-too-many-files`](/checks/placement/#directory-size) |
| `duplication` | [`no-declaration-is-written-twice`](/checks/duplication/) |
| `colocation` | `no-value-is-declared-away-from-its-only-consumer`, and `no-export-exists-only-for-a-test` when a zone also has `role: "tests"` |
| `members` | [`every-api-zone-is-exported`](/concepts/monorepos/#the-door-is-written-down-twice), for each member that has both a `package.json` with `exports` and an api zone |
| `runners` | [one claim per delegated category](/integrations/linters/) |
| `rules` | [whatever you name](/checks/custom-rules/) |

`no-zones-form-a-cycle` needs no configuration, because there is no version of a zone cycle anyone wants.

---
title: What it checks
description: Every claim the tool makes about a project, and why the first four fail loudly.
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
| `every-import-respects-its-zone-boundary` | the boundaries hold |
| `no-zones-form-a-cycle` | no group of zones depends on itself |
| `no-sibling-directory-reaches-another` | sibling directories stay independent |
| `generic-code-names-no-domain-concept` | the seams hold |
| `no-directory-holds-too-many-files` | no directory has become a drawer |
| `no-declaration-is-written-twice` | nothing exists in two copies |
| `no-value-is-declared-away-from-its-only-consumer` | nothing crosses a boundary for a single caller |
| `no-export-exists-only-for-a-test` | nothing is public just so a test can reach it |
| `every-delegated-tool-ran` | every other analyzer you configured actually ran |

## Why the first four fail loudly

An import that does not resolve. A name no module exports. A pattern matching nothing. Each of those means the tool is seeing less than you think it is.

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
| `runners` | [one claim per delegated category](/integrations/linters/) |
| `rules` | [whatever you name](/checks/custom-rules/) |

`no-zones-form-a-cycle` needs no configuration, because there is no version of a zone cycle anyone wants.

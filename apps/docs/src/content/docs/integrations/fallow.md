---
title: Compared to fallow
description: What overlaps, what does not, and why this is not built on top of it.
---

[fallow](https://docs.fallow.tools) is a codebase analyzer covering dead code, duplication, complexity and architecture boundaries. It is also the tool `trueline` delegates most of its commodity analysis to. The two overlap in one place, and this is the division.

## The overlap is the vocabulary, not the analysis

Both tools describe a project as named zones of file globs, first match wins, and both check that every file lands in one. Both have rules about which zone may reach which. Written down, the two configs look alike.

They part company on what a rule attaches to. fallow reports a violation as a pair of files and the specifier between them. `trueline` follows the re-export chain and anchors the rule on the file that **declares** the symbol — [why barrels break other tools](/concepts/boundaries/#why-barrels-break-other-tools) has what that changes and the measurement behind it.

fallow's documentation is explicit about the other side of this: a barrel is handled by *exempting* it, so re-exports raise no false positives. That is a reasonable choice for a module-level rule, and the opposite of the one made here.

## What only trueline does

| | |
|---|---|
| Rules anchored on the declaring file | a rule reaches through the barrel to the symbol |
| Imports checked by name | a named export that does not exist, and a name two `export *` barrels both supply |
| Zone roles | `wiring`, `tests` and `api` change what a rule counts as a consumer |
| Placement rules | where a file should live, given who uses it |
| Zone-level cycles | one finding per tangle, at zone granularity, with no rule written |
| Sibling isolation by pattern | one rule keeps `routes/*` apart without naming the routes |
| Seams | a generic zone naming a domain concept, with the vocabulary derived from your zones |
| Duplicate declarations | a declaration compared with its name stripped, at a size a clone detector cannot use |
| Rules you write yourself | a TypeScript function over the resolved graph |
| A write-time guard | judges a proposed edit before it reaches disk, and denies it |
| Per-package rulebooks | each member declares its own zones and what it may reach, composed at load |

## What only fallow does

Dead code is the large one: unused files, exports, types, enum and class members, and the dependency hygiene set. Clone detection across four modes. Complexity, churn and ownership. A security catalogue. Framework awareness through a large plugin set, which is what lets it understand an unused Vue prop or a Svelte event. Semantic function similarity through a local model. Runtime coverage. It also ships an MCP server, an LSP, and starter boundary presets — `layered`, `hexagonal`, `feature-sliced`, `bulletproof` — where zones here are always written by hand.

Its boundary rules take `allowTypeOnly`, naming which targets a zone may reach with `import type`. The equivalent here is coarser: `ignoreTypeOnly` exempts type imports for a whole rule rather than per target.

None of that is reimplemented here. Turn it on with `fallowRunner()` and its findings join this report and this baseline — see [using your existing linter](/integrations/linters/).

## Two of its features are deliberately not adopted

**Suppression comments.** fallow can silence a finding inline, and has rules to keep those comments honest — a stale one is reported, and a reason can be required. There is no suppression comment here at all. [The baseline](/agents/baseline/) is the only way to accept a finding, and it goes stale loudly. A comment sits next to the code it excuses, and nothing ever revisits it.

**Severities on completeness checks.** In fallow every built-in rule takes `error`, `warn` or `off`, unresolved imports included. Set that one to `off` and every other analysis keeps running on a graph that is missing edges, still reporting clean. Here an import that does not resolve is an error with no knob, alongside zero files matched and a pattern that matches nothing. A check that could not see is never a check that passed.

## Why this is not built on top of fallow

A fair question, since the analysis half is delegated already.

fallow exposes findings, never the graph. Its two extension points are declarative data by design — rule packs ban calls, imports, effects and exports, and "loading a pack never executes project code"; plugins seed entry points and used exports. Neither can express a rule that counts consuming zones or asks where a symbol was declared. Its nearest rule kind matches the raw specifier, and documents that aliased ones are not matched, which is the inverse of anchoring on the declaration.

Its Node bindings wrap the same one-shot analyses and return the same reports, so they change the transport rather than what can be asked.

Its `guard` command accepts paths that do not exist yet, but takes paths rather than content: it reports which rules apply to a file. Judging bytes that are not on disk is a different job.

## Running both

Neither tool needs the other turned off. If you run both, zones are declared twice, in two formats, and nothing keeps them in sync. Keep this config as the source of truth — fallow's zones carry no roles, its config inheritance replaces arrays rather than merging them, and a package cannot contribute zones upward.

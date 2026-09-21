---
title: Compared to fallow
description: Where the two tools overlap, where they do not, and why trueup is not built on top of fallow.
---

:::note
You do not need fallow to use trueup, and nothing on this page is setup. Read it if you already run fallow, or if you want to know why the two overlap.
:::

[fallow](https://docs.fallow.tools) is a codebase analyzer. It covers dead code, duplication, complexity and architecture boundaries, and it is also the tool trueup hands most of its ordinary analysis to.

A zone is a name you give to a group of files, chosen by where the files sit. A boundary is a note saying which zones a zone is allowed to reach. Zone boundaries are the one place the two tools overlap, and the rest of this page draws that line.

## The overlap is the vocabulary, not the analysis

Both tools describe a project as named zones of file globs, first match wins, and both check that every file lands in one. Both have rules about which zone may reach which. Written down, the two configs look alike.

They part company on what a rule attaches to. In fallow a violation is a pair of files and the import text between them. In trueup the rule follows the re-exports and sits on the declaring file, the one where the thing is actually written. [Why barrels break other tools](/concepts/boundaries/#why-barrels-break-other-tools) has what that changes, and the measurement behind it.

A barrel is a file that re-exports its neighbours so people can import from one place. The fallow documentation is explicit about the other side of this: a barrel is handled by *exempting* it, so re-exports raise no false positives. That is a reasonable choice for a rule about modules, and the opposite of the one made here.

## What only trueup does

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

| | |
|---|---|
| dead code | unused files, exports, types, enum and class members, plus dependency hygiene |
| clone detection | four modes |
| complexity, churn, ownership | |
| a security catalogue | |
| framework awareness | a large plugin set, which is how it knows an unused Vue prop or a Svelte event |
| semantic function similarity | through a locally run model |
| runtime coverage | |
| boundary presets | `layered`, `hexagonal`, `feature-sliced`, `bulletproof`; zones here are always written by hand |

It also ships an MCP server and a language server.

Its boundary rules take a setting called allowTypeOnly, which names the targets a zone may reach with a type-only import. The one here is coarser. It is called ignoreTypeOnly, and it excuses type-only imports for a whole rule rather than target by target.

None of that is reimplemented here. A line of config hands the job to fallow, and its findings join this report and this baseline. [Using your existing linter](/integrations/linters/) has that line.

## Two off switches that do not exist here

**Suppression comments.** fallow can silence a finding with a comment in the code, and it has rules to keep those comments honest. A stale one is reported, and a reason can be required. There is no suppression comment here at all. [The baseline](/agents/baseline/), the recorded list of problems you have agreed to live with for now, is the only way to accept a finding, and it goes stale loudly. A comment sits next to the code it excuses, and nothing ever revisits it.

**Severities on completeness checks.** In fallow every built-in rule takes error, warn or off, unresolved imports included. Set that one to off and every other analysis keeps running on a graph with holes in it, and keeps reporting clean. Here an import that does not resolve is an error with no knob, alongside zero files matched and a pattern that matches nothing. A check that could not see is never a check that passed.

## Why this is not built on top of fallow

fallow hands out findings, never the graph behind them. Both of its extension points are declarative by design and never run code from your project. Neither one can count the zones consuming a file, or ask where a symbol was declared.

Its nearest rule kind matches the import text as written, and explicitly does not match an aliased one. Its Node bindings run the same analyses through a different call. And the guard it ships, the part that inspects an edit before it is saved, takes a path rather than the contents a tool is proposing to write.

## Running both

Neither tool needs the other turned off. If you run both, your zones are declared twice, in two formats, and nothing keeps them in sync. Keep this config as the source of truth. fallow's zones carry no roles, its config inheritance replaces arrays instead of merging them, and a package cannot contribute zones upward.

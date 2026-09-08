---
title: Reading a report
description: What a claim is, why the whole list always prints, and the two output modes worth knowing.
---

Here is a run with one violation.

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
    src/engine/table.ts:14:9  is engine and may not reach domain: Warrant from src/domain/warrant.ts through src/shared/index.ts
    Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its
    declaring file, so a barrel in between does not excuse it. Move the code to a zone that may
    reach the target, or have the target expose what the caller needs through a zone it may reach.
    Run `trueline explain <file>` to see what a file may reach. Widening the rule is not the fix.

no-zones-form-a-cycle                       ok
generic-code-names-no-domain-concept        ok

11 claims · 1 error · 0 warnings
```

The first two lines are a receipt. They exist so a clean report cannot mean "I checked nothing".

An **edge** is one imported name in one file — `import { a, b } from "./x"` is two. They are counted by what they reach: `symbol` for a name declared in a file the run read, `external` for one that leaves your source (a package, a stylesheet, an image), `builtin` for `node:` modules, and `unresolved` for a specifier that pointed nowhere.

You are looking for two things. `unresolved` should be `0`, because every unresolved import is an edge no rule could judge. And the file count should look like your project — if it is far too small, the run is checking less than you think.

Each line after that is a **claim**: a statement about the project that is either true, or true except for the counterexamples listed underneath.

Every claim runs on every pass, and the whole list always prints. Fixing one thing still tells you whether everything else moved.

Under the findings sits the guidance for that claim. It says what the violation means and how to resolve it, written for whoever hits the rule without having read these pages — which, most of the time, is the agent.

## When you only want the failures

```sh
npx trueline --dots
```

One character per claim, then nothing else unless something failed.

```
................  80 files · 496 edges · 0 unresolved

16 claims · 0 errors · 0 warnings
```

`.` is a claim that holds, `!` one whose only findings are in the baseline, `E` one with real errors. Only the `E`s are explained, and only their error findings — a claim's warnings stay counted in the tally and out of your way.

```
........E...!...  80 files · 496 edges · 0 unresolved
baseline  2 known · 0 stale

every-import-respects-its-zone-boundary  1 error
    src/engine/table.ts:14:9  is engine and may not reach domain: Warrant from src/domain/warrant.ts
    Code in one zone reached a symbol declared in a zone it may not reach. …

16 claims · 1 error · 2 warnings
```

The counts stay on the first line on purpose. A reporter that prints nothing when clean cannot tell you apart from a run that analysed nothing.

This is the one worth handing to an agent that checks after every change. A green run costs it two lines instead of twenty.

## When you want one thing to fix

```sh
npx trueline --next
```

One problem, then stop.

```
problem 1 of 12 · 16 claims · 12 errors · 0 warnings

no-declaration-is-written-twice  3 errors
    src/zones/assign.ts:11:6      declares toPosix, which is written the same way in …
    src/claims/isolation.ts:17:6  declares posix, which is written the same way in …
    src/guard/protected.ts:26:6   declares posix, which is written the same way in …
    The same declaration was written more than once, in files that could have shared it. …
```

A problem is not a finding. Findings that share one cause arrive together, because you cannot fix one copy of a duplicated declaration without seeing the others. Everything else is one finding, one problem.

The order is the order the claims run, so the checks about the analysis itself come first. That matters: while an import fails to resolve, every other answer is drawn from a graph with a hole in it.

Run it, fix what it shows, run it again. It reports `nothing left to fix` when the errors are gone.

## Exit codes

| code | meaning |
|---|---|
| `0` | clean |
| `1` | errors |
| `2` | the baseline holds entries whose violations are gone |
| `3` | no config found |

## Cost

A full check on a 900-file monorepo takes about a tenth of a second. The guard takes about the same, including process startup.

Identifiers are only read when a [seam rule](/checks/seams/) or a [rule of your own](/checks/custom-rules/) asks for them. A run without either never builds a syntax tree.

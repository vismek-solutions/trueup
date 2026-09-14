---
title: Reading a report
description: How to read what trueup prints, and the other ways it can print it.
---

Every run prints a list of claims. A claim is one sentence trueup believes about your project, and a run either proves it or shows you the places where it is not true.

Here is a run where one claim did not hold.

```
coverage  898 files · 7524 edges · 5816 symbol · 4 namespace · 1663 external · 41 builtin · 0 unresolved
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
    ────────
    Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its
    declaring file, so a barrel in between does not excuse it.

    Do this:
    - Move the code to a zone that may reach the target.
    - Or have the target expose what the caller needs through a zone the caller may reach.
    - Run `trueup explain <file>` to see what a file may reach.

    Not the fix: widening the rule so the edge becomes legal.

no-zones-form-a-cycle                       ok

10 claims · 1 error · 0 warnings
```

The first two lines are a receipt. They exist so that a clean report cannot mean "I checked nothing".

An edge is one name imported by one file. So this line is two edges rather than one:

```ts
import { a, b } from "./x"
```

An import that names nothing inside a module is one edge onto the module itself. A namespace import works that way, and so does an import awaited while the program runs, because neither one says which export it will use.

A specifier the program builds as it runs names no file, so nothing about it can be checked.

Each edge is counted by what it reaches.

| | |
|---|---|
| `symbol` | a name declared in a file the run read |
| `namespace` | a whole module, where the import named nothing inside it |
| `external` | anything outside your source: a package, a stylesheet, an image |
| `builtin` | a `node:` module |
| `unresolved` | a specifier that pointed nowhere |

Two things on that first line are worth a look. The unresolved count should be zero, because an unresolved import is an edge no rule could judge. And the file count should look like your project. If it is far too small, the run is checking less than you think.

Each line after the receipt is one claim. It either holds, or it holds everywhere except the places listed underneath.

Every claim runs on every pass, and the whole list always prints. Fixing one thing still tells you whether everything else moved.

Under that list, past a short rule that marks where the findings end, sits the guidance for that claim. It says what the violation means and what to do about it. Where a claim reports in more than one shape, the guidance carries only the parts that match the findings you have. It is written for whoever meets the rule without having read these pages, and most of the time that is an agent, meaning a coding assistant writing code in your project.

## When you only want the failures

```sh
npx trueup --dots
```

One character per claim, then nothing else unless something failed.

```
................  80 files · 496 edges · 0 unresolved

16 claims · 0 errors · 0 warnings
```

| | |
|---|---|
| `.` | a claim that holds |
| `!` | a claim whose only findings are in the baseline |
| `E` | a claim with real errors |

Only the claims with real errors are explained, and only their errors. Warnings stay in the tally.

```
........E...!...  80 files · 496 edges · 0 unresolved
baseline  2 known · 0 stale

every-import-respects-its-zone-boundary  1 error
    src/engine/table.ts:14:9  is engine and may not reach domain: Warrant from src/domain/warrant.ts
    ────────
    Code in one zone reached a symbol declared in a zone it may not reach. …

16 claims · 1 error · 2 warnings
```

The counts stay on the first line even here. A short report still has to show you that something was checked.

This is the mode to hand to an agent that checks after every change it makes. A green run costs it two lines instead of twenty.

## When you want one thing to fix

```sh
npx trueup --next
```

One problem, then stop.

```
problem 1 of 12 · 16 claims · 12 errors · 0 warnings

no-declaration-is-written-twice  3 errors
    src/zones/assign.ts:11:6      declares toPosix, which is written the same way in …
    src/claims/isolation.ts:17:6  declares posix, which is written the same way in …
    src/guard/protected.ts:26:6   declares posix, which is written the same way in …
    ────────
    The same declaration was written more than once, in files that could have shared it. …
```

A problem is not the same as a finding. Findings that share one cause arrive together, because you cannot fix one copy of a duplicated declaration without seeing the others. Everything else is one finding, one problem.

Problems arrive in the order the claims run, so the checks about the analysis itself come first. While an import fails to resolve, every other answer is drawn from a graph with a hole in it.

Run it, fix what it shows, run it again. When the errors are gone it tells you there is nothing left to fix.

## When something else has to read it

```sh
npx trueup --json
```

The whole report, claims in the order they ran, each with its findings. A claim that found nothing carries no guidance, because the remedy is written for a violation that is not there.

```json
{
  "claims": [
    {
      "claim": "every-imported-name-is-unambiguous",
      "guidance": "Two star re-exports supply the same name, so which one a consumer gets is undefined and no rule can say where it came from.\n\nDo this:\n- Export it from one place.\n- Or re-export it by name rather than through a star.",
      "findings": [
        {
          "severity": "error",
          "message": "imports price from ../pricing/index.js, which re-exports it from more than one module",
          "file": "/home/you/shop/src/checkout/total.ts",
          "start": 9
        }
      ]
    }
  ],
  "coverage": {
    "files": 5,
    "edges": 2,
    "symbolEdges": 0,
    "externalEdges": 0,
    "builtinEdges": 0,
    "namespaceEdges": 0,
    "unresolvedImports": 0,
    "filesByZone": { "pricing": 3, "checkout": 2 },
    "unclassifiedFiles": 0
  }
}
```

A claim that holds keeps its entry, with an empty list of findings. The shape does not change between a green run and a red one. The file path is absolute, and the start is a character offset into that file. The exit code is the same as in any other mode.

## On a GitLab merge request

```sh
npx trueup --gitlab
```

The same findings in GitLab's Code Quality format, which puts each one on its line in the merge request diff. A red pipeline then says what broke without anyone opening the job log.

```json
[
  {
    "description": "is web/pages and may not reach lib/domain: isSettled from packages/lib/src/domain/order.ts — Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its declaring file, so a barrel in between does not excuse it.\n\nlib has an api zone, so every other package reaches it through lib/api and nowhere else. That closes lib/domain.\n\nDo this:\n- Move the code to a zone that may reach the target. …",
    "check_name": "every-import-respects-its-zone-boundary",
    "fingerprint": "a6336074136ec154dc9fcaa5bf72dacab993d46e2b1fe6d2ad64dd52a09be576",
    "severity": "major",
    "location": { "path": "apps/web/src/cart.ts", "lines": { "begin": 2 } }
  }
]
```

The guidance rides along in the description field, because that is the only field GitLab shows.

Severity follows the baseline, which is the recorded list of problems you have agreed to live with for now. A new violation is major. One [the baseline](/agents/baseline/) already accepted is minor, so it stays visible in the widget without competing with what this branch broke. Nothing is ever a blocker, because the exit code already fails the pipeline.

```yaml
architecture:
  script: npx trueup --gitlab > gl-code-quality-report.json
  artifacts:
    when: always
    reports:
      codequality: gl-code-quality-report.json
```

The part to get right is the line that keeps the artifact on every run. Without it, the artifact is dropped on exactly the runs that had something to say.

Some findings name no file at all: an empty zone, or a pattern nothing matches. Those are placed on the config they came from. The fingerprint is a hash of the claim, the path and the message, with no line number in it, so reformatting a file does not bring back a finding GitLab had already seen.

:::note
GitLab renders an annotation only on lines the merge request touched. A boundary violation sits on the import that caused it, so it lands. A directory-size finding has no line, so it shows in the widget instead. Either way the pass or fail is [the baseline's](/agents/baseline/) job, and we would ask you not to use the Code Quality widget as the ratchet.
:::

## A flag trueup does not know

```
$ npx trueup --claim=no-directory-holds-too-many-files
unrecognised: --claim=no-directory-holds-too-many-files

trueup — checks that the code matches the architecture its rulebook describes

usage: trueup [options]
       trueup <command> [arguments]
```

The full list of options and commands follows that, so a mistyped flag also shows you the right one. You can ask for the same list at any time:

```sh
npx trueup --help
```

Suppose trueup had quietly ignored that flag and run the default check instead. It would tell you the project is clean, having done something other than what you asked. That is the same silence the completeness claims exist to prevent, so it gets its own exit code rather than being folded into a failed run.

Two flags that each ask for a different report are refused the same way, rather than one of them winning quietly:

```
$ npx trueup --dots --json
--dots and --json answer different questions, so give one of them

trueup — checks that the code matches the architecture its rulebook describes

usage: trueup [options]
       trueup <command> [arguments]
```

## Exit codes

| code | meaning |
|---|---|
| `0` | clean |
| `1` | errors |
| `2` | the baseline holds entries nothing reports any more |
| `3` | no rulebook found |
| `4` | an argument it does not know |
| `5` | the rulebook would not load |

## Cost

A full check on a 900-file monorepo takes about a tenth of a second. The guard is the part that inspects an edit before it is saved, and it takes about the same, including the time to start the process.

Identifiers are only read when a [seam rule](/checks/seams/) or a [rule of your own](/checks/custom-rules/) asks for them. A run without either never builds a syntax tree.

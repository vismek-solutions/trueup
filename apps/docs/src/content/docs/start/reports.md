---
title: Reading a report
description: What a claim is, why the whole list always prints, and the two other output modes.
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
    Run `trueup explain <file>` to see what a file may reach. Widening the rule is not the fix.

no-zones-form-a-cycle                       ok
generic-code-names-no-domain-concept        ok

11 claims · 1 error · 0 warnings
```

The first two lines are a receipt. They exist so a clean report cannot mean "I checked nothing".

An **edge** is one imported name in one file, so `import { a, b } from "./x"` is two. Each is counted by what it reaches:

| | |
|---|---|
| `symbol` | a name declared in a file the run read |
| `external` | anything outside your source: a package, a stylesheet, an image |
| `builtin` | a `node:` module |
| `unresolved` | a specifier that pointed nowhere |

You are looking for two things. `unresolved` should be `0`, because an unresolved import is an edge no rule could judge. And the file count should look like your project — if it is far too small, the run is checking less than you think.

Each line after that is a **claim**: a statement about the project that is either true, or true except for the counterexamples listed underneath.

Every claim runs on every pass, and the whole list always prints. Fixing one thing still tells you whether everything else moved.

Under the findings sits the guidance for that claim. It says what the violation means and how to resolve it, written for whoever hits the rule without having read these pages — which, most of the time, is the agent.

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

Only `E` claims are explained, and only their errors. Warnings stay in the tally.

```
........E...!...  80 files · 496 edges · 0 unresolved
baseline  2 known · 0 stale

every-import-respects-its-zone-boundary  1 error
    src/engine/table.ts:14:9  is engine and may not reach domain: Warrant from src/domain/warrant.ts
    Code in one zone reached a symbol declared in a zone it may not reach. …

16 claims · 1 error · 2 warnings
```

The counts stay on the first line even here, for the reason given above.

Hand this one to an agent that checks after every change: a green run costs it two lines instead of twenty.

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
    The same declaration was written more than once, in files that could have shared it. …
```

A problem is not a finding. Findings that share one cause arrive together, because you cannot fix one copy of a duplicated declaration without seeing the others. Everything else is one finding, one problem.

Problems arrive in the order the claims run, so the checks about the analysis itself come first. While an import fails to resolve, every other answer is drawn from a graph with a hole in it.

Run it, fix what it shows, run it again. It reports `nothing left to fix` when the errors are gone.

## When something else has to read it

```sh
npx trueup --json
```

The whole report, claims in the order they ran, each with its guidance and its findings.

```json
{
  "claims": [
    {
      "claim": "every-imported-name-is-unambiguous",
      "guidance": "Two star re-exports supply the same name, so which one a consumer gets is undefined and no rule can say where it came from. Export it from one place, or re-export it by name.",
      "findings": [
        {
          "severity": "error",
          "message": "src/checkout/total.ts imports price from ../pricing/index.js, which re-exports it from more than one module",
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

A claim that holds keeps its entry with an empty `findings`, so the shape does not change between a green run and a red one. `file` is absolute and `start` is a character offset into it. The exit code is the same as any other mode.

## On a GitLab merge request

```sh
npx trueup --gitlab
```

The same findings in GitLab's Code Quality format, which puts each one on its line in the merge request diff. A red pipeline then says what broke without anyone opening the job log.

```json
[
  {
    "description": "is web/pages and may not reach lib/domain: isSettled from packages/lib/src/domain/order.ts — Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its declaring file, so a barrel in between does not excuse it. …",
    "check_name": "every-import-respects-its-zone-boundary",
    "fingerprint": "a6336074136ec154dc9fcaa5bf72dacab993d46e2b1fe6d2ad64dd52a09be576",
    "severity": "major",
    "location": { "path": "apps/web/src/cart.ts", "lines": { "begin": 2 } }
  }
]
```

The guidance rides along in `description`, because that is the only field GitLab shows.

Severity follows the baseline. A new violation is `major`; one [the baseline](/agents/baseline/) already accepted is `minor`, so it stays visible in the widget without competing with what this branch broke. Nothing is ever `blocker` — the exit code already fails the pipeline.

```yaml
architecture:
  script: npx trueup --gitlab > gl-code-quality-report.json
  artifacts:
    when: always
    reports:
      codequality: gl-code-quality-report.json
```

`when: always` is the part to get right. Without it the artifact is dropped on exactly the runs that had something to say.

Findings that name no file — an empty zone, a dead pattern — are placed on the config they came from. The fingerprint is a hash of the claim, the path and the message, with no line number in it, so reformatting a file does not resurrect a finding GitLab had already seen.

:::note
GitLab renders an annotation only on lines the merge request touched. A boundary violation sits on the import that caused it, so it lands; a directory-size finding has no line and shows in the widget instead. The pass or fail is [the baseline's](/agents/baseline/) job either way — do not use the Code Quality widget as the ratchet.
:::

## A flag it does not know is an error

```
$ npx trueup --claim=no-directory-holds-too-many-files
unrecognised: --claim=no-directory-holds-too-many-files
known arguments: --json --gitlab --next --dots --update-baseline --config=<path>
commands: explain <path> · guard · agent-instructions
```

A tool that ignored `--dot` and ran the default check would report a clean project while doing something other than what you asked. That is the same silence the completeness claims exist to prevent, so it gets its own exit code rather than being folded into a failed run.

## Exit codes

| code | meaning |
|---|---|
| `0` | clean |
| `1` | errors |
| `2` | the baseline holds entries whose violations are gone |
| `3` | no config found |
| `4` | an argument was not recognised |

## Cost

A full check on a 900-file monorepo takes about a tenth of a second. The guard takes about the same, including process startup.

Identifiers are only read when a [seam rule](/checks/seams/) or a [rule of your own](/checks/custom-rules/) asks for them. A run without either never builds a syntax tree.

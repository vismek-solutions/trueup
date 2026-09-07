# trueline

`trueline` keeps a TypeScript codebase in the shape you meant it to have. It also stops a coding agent from quietly changing that shape.

It reads your source files without running them. It works out which file depends on which. Then it compares that against rules you wrote down. When something breaks a rule, it names the file, says what it did, and says what to do about it.

## Contents

- [What this is](#what-this-is) — the idea, and why it exists
- [Getting started](#getting-started) — install, configure, run
- [Zones](#zones) — the one concept everything else is built on
- [Reading a report](#reading-a-report)
- [What it checks](#what-it-checks) — the full list
- [Boundaries](#boundaries) — which zones may reach which
- [Sibling directories](#sibling-directories) — routes and features that must stay apart
- [Blocking a bad edit](#blocking-a-bad-edit) — the agent hook
- [Teaching the agent up front](#teaching-the-agent-up-front)
- [Asking before writing](#asking-before-writing) — the `explain` command
- [Adopting on an existing codebase](#adopting-on-an-existing-codebase) — the baseline
- [Seams](#seams) — leaks that cross no import
- [Directory size](#directory-size)
- [The same thing written twice](#the-same-thing-written-twice) — the way an agent grows a codebase
- [Code that crossed a boundary for one caller](#code-that-crossed-a-boundary-for-one-caller)
- [Rules you write yourself](#rules-you-write-yourself)
- [Using your existing linter alongside it](#using-your-existing-linter-alongside-it)
- [Exit codes](#exit-codes) · [Cost](#cost)

## What this is

### It reads between files, not inside them

A linter reads one file at a time and tells you about that file. An unused variable. A missing `await`. It is looking at the code *inside* a file.

`trueline` looks at the lines *between* files. Which parts of your project may know about which other parts. Where things live. Whether a folder has quietly become a junk drawer.

None of that is visible from inside any single file. That is exactly why it goes wrong without anyone noticing.

You describe the shape once, in a config file. Every run after that answers one question: is this still true?

### Why it exists

An agent writing code optimises for the change in front of it. Reaching into another module is the shortest path to a working feature, so that is the path it takes.

Every individual edit is defensible. The tests stay green. After a hundred of them the project is a ball of mud that nobody chose.

You cannot review your way out of this. The whole point of the agent is that you are not reading every line. So the constraints have to live somewhere the agent runs into them, every time, without you.

That is what this is. A rule the agent can edit is a rule the agent will edit once it is under pressure to make the output green — so every message this prints says the same thing. Fix the code, not the rule.

## Getting started

Requires Node 22.18 or newer.

```
npm install --save-dev trueline
```

Now create `architecture.config.ts` at the root of your project.

```ts
import { defineConfig } from "trueline";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "spec", patterns: ["**/*.test.ts"] },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "engine", patterns: ["src/engine/**"] },
    { name: "app", patterns: ["src/**"] },
  ],
  boundaries: [{ from: "engine", mayNotReach: ["domain", "app"] }],
});
```

That config says the project has four kinds of file, and that `engine` code may not reach into `domain` or `app`.

Then run it.

```
npx trueline
```

## Zones

A **zone** is a name for a group of files, chosen by path patterns. Zones are the vocabulary every other rule is written in. This is the one idea worth getting right.

### Order matters

A file belongs to the first zone whose pattern matches it. Order them narrowest first.

In the config above, `src/domain/user.test.ts` is `spec` rather than `domain`, because `spec` comes first.

### Every file must land somewhere

A file in no zone is an error, not a shrug. A file nothing has classified is a file no rule can govern.

Put your tests in their own zone, ahead of everything else. Left inside a source zone, fixture text leaks into the other checks.

## Reading a report

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

generic-code-names-no-domain-concept        ok

10 claims · 1 error · 0 warnings
```

The first two lines are a receipt. They exist so a clean report cannot mean "I checked nothing". If the file count or the edge count looks wrong, you see it before you trust the `ok`s.

Each line after that is a **claim**. A claim is a statement about the project that is either true, or true except for the counterexamples listed underneath.

Every claim runs on every pass, and the whole list always prints. Fixing one thing still tells you whether everything else moved.

Under the findings sits the guidance for that claim. It says what the violation means and how to resolve it. It is written for whoever hits the rule without having read this file — which, most of the time, is the agent.

### When you only want the failures

```
npx trueline --dots
```

One character per claim, then nothing else unless something failed.

```
................  80 files · 496 edges · 0 unresolved

16 claims · 0 errors · 0 warnings
```

`.` is a claim that holds, `!` one whose only findings are in the baseline, `E` one with real errors. Only the `E`s are explained, and only their error findings — a claim's warnings stay counted in the tally and out of your way.

The counts stay on the first line on purpose. A reporter that prints nothing when clean cannot tell you apart from a run that analysed nothing.

This is worth handing to an agent that checks after every change. A green run costs it two lines instead of twenty.

### When you want one thing to fix

```
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

## What it checks

| claim | asserts |
|---|---|
| `the-analysis-reached-files` | the run analysed something |
| `every-import-resolves` | no import failed to resolve to a real file |
| `every-imported-name-is-exported` | every imported name exists in the module it came from |
| `every-imported-name-is-unambiguous` | no name arrives through two different re-export chains |
| `every-file-belongs-to-a-zone` | every file matches exactly one zone |
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

The first four are about the analysis itself, and they fail loudly on purpose.

An import that does not resolve. A name no module exports. A pattern matching nothing. Each of those means the tool is seeing less than you think it is. A check that reports success while enforcing nothing is worse than no check at all.

### Imports your build tool supplies

Frameworks invent specifiers that exist only at build time. `astro:content` is not on disk and never will be, so it fails `every-import-resolves` like any typo would.

Name them and they become external instead:

```ts
externals: ["astro:*", "virtual:*", "#imports"]
```

`*` matches any run of characters, slashes included — these are specifiers, not paths, so `virtual:*` covers `virtual:site/heading`.

Nothing relative or absolute can be declared external. A pattern that would swallow `./thing.ts` is ignored for that import, so the escape valve can never hide your own files.

Do not reach for the baseline here. A virtual specifier fails on every run, so baselining it buries the check permanently — and the next real typo lands in the same silence.

## Boundaries

A boundary names a zone, and the zones it may not reach.

```ts
boundaries: [
  { from: "engine", mayNotReach: ["domain"] },
  { from: "engine", mayNotReach: ["app"], ignoreTypeOnly: true },
]
```

### Why barrels break other tools

This is the part that makes `trueline` different from every other tool of its kind.

Most projects have a **barrel**. That is a file, usually `index.ts`, that re-exports everything around it so consumers can import from one place. `import { Warrant } from "@app/shared"` beats a path six directories deep.

Barrels also make dependency rules useless. To a tool that reads import statements, every consumer of that package looks identical — they all import from `shared/index.ts`. A rule saying "components may not touch warrants" then matches all of those imports or none of them. Neither is the truth.

`trueline` follows the re-export chain to the file that actually **declares** the thing you imported, and anchors the rule there.

On a real monorepo, the same rule written both ways:

| anchored on | result |
|---|---|
| the file that declares the symbol | the four component files that reach `warrants.ts` |
| the module the import statement named | nothing at all |

The second row is where import-graph tools sit. That includes ones which resolve the barrel perfectly well. Resolving it is not the hard part. Attaching the rule to the symbol is.

### Two options on a boundary

`anchor: "imported-module"` gives you the blunt version — "this package is off limits entirely". Leave it alone for anything finer.

`ignoreTypeOnly: true` exempts `import type`. Use it when you care that runtime code crossed, rather than that a type name did.

### Zones that depend on each other

This one holds whether or not you wrote a boundary, and takes no configuration.

If `catalog` imports from `checkout` and `checkout` imports back from `catalog`, neither can be read, tested, moved or deleted on its own. The same defect closes the long way round, through a third zone or a fourth, where no pair of zones looks wrong on its own.

```
no-zones-form-a-cycle                     2 errors
    zones catalog and checkout form an import cycle
    zones billing, invoice and ledger form an import cycle
```

Each tangle is reported once, not once per zone in it.

Boundaries cannot say this. You would need a rule for every pair of zones, written out by hand, and the pair that traps you is the one you did not predict. Adding a boundary afterwards does not break a cycle either — the imports have to change.

## Sibling directories

Zones are named, so a boundary between them has to be written out. That falls apart when the directories are many, similar, and constantly added to.

Think `src/routes/a`, `src/routes/b`, `src/routes/c`. The rule you want is "none of these knows about any other".

Written as zones, that needs one zone and one boundary per route. Worse, a route added tomorrow is governed by nothing until someone remembers to add it.

### Declaring a group

```ts
isolate: [{ siblings: "src/routes/*", except: ["_shared"] }]
```

The `*` names the group. Every directory it matches becomes an island.

Files inside an island may import each other freely, and may reach anything outside the group. They may not reach a sibling.

A new directory is isolated the moment it exists, with no config change. That is the whole point.

### What it reports

```
no-sibling-directory-reaches-another        2 errors
    src/routes/a/page.ts:1:0        is a and may not reach sibling b: thing from src/routes/b/thing.ts
    src/routes/c/deep/inner.ts:1:0  is c and may not reach sibling b: thing from src/routes/b/thing.ts
```

Depth does not matter. `src/routes/c/deep/inner.ts` is still `c`.

The parent itself is in no group. So `src/routes/index.ts` importing every route is fine — that is what a parent is for.

More than one `*` is allowed, and each combination is its own island. `apps/*/features/*` keeps `web/cart` apart from `web/checkout` and from `admin/cart`.

If the pattern matches no directory at all, that is an error rather than a silent pass. A rule guarding nothing is the failure mode this tool exists to prevent.

### On `except`

`except` is for the directory the group is meant to share. Use it for `_shared` and little else.

The shared thing is usually the answer to a finding, not an exception to it.

## Blocking a bad edit

This is the part that matters most if you are working with an agent.

Claude Code can run a command before it writes a file, and cancel the write if that command objects. `trueline guard` is that command.

It reads the proposed edit, applies it to a copy of the file in memory, and checks the *result* against the real project. The file never has to exist on disk.

### The hook

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|mcp__serena__replace_content",
        "hooks": [{ "type": "command", "command": "npx trueline guard" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__serena__(replace_content|replace_symbol_body|replace_in_files|insert_after_symbol|insert_before_symbol|rename_symbol|safe_delete_symbol)",
        "hooks": [{ "type": "command", "command": "npx trueline guard" }]
      }
    ]
  }
}
```

The agent gets the refusal as its tool result, carrying the same explanation the report prints. It corrects course inside the same turn. Nothing lands on disk, and no round trip through you is needed.

The refusal ends with what the file *may* reach, not just what it may not.

```
every-import-respects-its-zone-boundary  src/engine/table.ts
  is engine and may not reach domain: Warrant from src/domain/warrant.ts
  Code in one zone reached a symbol declared in a zone it may not reach. …
engine may reach engine · shared
```

The moment an agent has been refused is the moment it is about to guess. Telling it where it may go costs one line and saves the turn spent guessing wrong.

If you are not using Serena, the `Write|Edit` matcher alone covers everything. Drop the second block.

### What can and cannot block

Only findings on the file being written can block it. Someone else's standing violation is not this edit's problem, and blocking on one would make every edit in an existing codebase impossible.

Anything already in the baseline does not block either.

An unusable payload, a missing config, a file type you do not analyse — all of those allow the write. A guard that errors would block *every* edit rather than the wrong ones.

### The rulebook goes through you

Every other rule can be switched off by editing the config, so the guard stops that edit and hands it to you.

Two files are covered with no configuration at all: the config the rules were read from, and the baseline. Those are the two ways to make a failing check pass without touching any code — widen the boundary, or record the violation as already known.

The default is a permission prompt, not a refusal.

```
This edit needs your approval under the project's architecture rules.

no-edit-changes-the-rules-themselves  architecture.config.ts
  An agent is asking to change a file the project's rules are read from. Approve it if this is
  setup, or a change to the rules you meant to make. Refuse it if a check was failing just before
  this: editing the rulebook is how a failing check gets switched off, and it leaves no trace that
  it ever failed.
```

That keeps setup work possible. An agent can draft your zones, add one for a directory you just made, or wire the hooks — you approve each one. What it cannot do is quietly widen a rule that is red right now, because you see the request and the reason for suspecting it.

Add anything else that should come to you first.

```ts
protect: [".claude/settings.json", ".github/workflows/**", "CLAUDE.md"]
```

The hook settings are the entry worth copying. Without them, the shortest way past the guard is to turn the guard off.

### When nobody is there to answer

A prompt is only a gate while someone is at the keyboard. In a permission mode where nothing is put to a person — `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions` — the ask is downgraded to a refusal automatically. You do not configure that.

A prompt also cannot be waited out. Nothing turns an unanswered one into an approval, because waiting would then be the way past the guard.

What is left is the case where you are in `default` mode but away from the desk. The prompt sits there, and the agent sits with it. If that matters more to you than agent-driven setup, ask for a refusal outright.

```ts
protect: { paths: ["CLAUDE.md"], decision: "deny" }
```

`decision` on its own hardens the config and the baseline without naming anything else.

```ts
protect: { decision: process.env.CI === undefined ? "ask" : "deny" }
```

### Two things this check does differently

It runs before the roots and extension filters, so it covers files the analysis would never look at — a `.json`, a `.yml`, anything outside `include`.

It has no counterpart in a full run, because a snapshot of the code cannot show that the config was edited. This is the only rule that exists purely at write time.

You still edit these files yourself, directly. The hook only sees what an agent does.

### Why there are two hooks

To judge an edit before it happens, the guard has to work out what the file would look like afterwards.

For a plain find-and-replace, that is straightforward. For an edit expressed as "replace the body of this function", it is not. That needs the language server's idea of where the function starts and ends, which lives inside the editing tool rather than here.

So tools whose result can be reproduced exactly are checked *before* the write, and can be refused. Everything else is checked immediately *after* the write, against the real file, and comes back as a correction rather than a refusal.

The guard never guesses at another tool's edit semantics. Guessing is how this class of tool goes quietly wrong.

## Teaching the agent up front

```
npx trueline agent-instructions >> CLAUDE.md
```

This prints a short block naming your zones, the two commands worth running, and the instruction that matters most: fix the code, not the rule.

Blocking an edit teaches the agent one rule at a time, at the moment it breaks it. This teaches it the shape before it starts.

## Asking before writing

```
$ npx trueline explain src/engine/newThing.ts

zone        engine
may reach   engine · shared
may not     domain
vocabulary  domain owns names this file may not use:
            Warrant · WarrantKind · warrantKinds
            and values it may not repeat:
            search · testimony
```

Useful to you when deciding where something goes. Useful to an agent told to run it before creating a file.

A path in no zone is reported as such. That is the answer you want before making a directory nothing covers.

## Adopting on an existing codebase

Almost nobody starts clean. Record what is already there, then hold the line.

```
npx trueline --update-baseline
```

The **baseline** is a file listing the violations that existed when you started.

From then on, a new violation fails the build. A recorded one prints as a warning — visible, not hidden, so nobody forgets the debt is there.

### When you fix something

If you fix a violation that was in the baseline, the run exits `2` and tells you to update it.

That sounds fussy, and it is the entire point. Without it, a baseline slowly turns into a list of permanent exemptions nobody dares delete.

Entries are keyed on the claim, the file and the message. Never on a line number, so moving code around does not churn the file.

A run where nothing was analysed can never be recorded. A broken config cannot silently baseline your whole project.

## Seams

A boundary catches a bad import. It cannot catch the other way domain knowledge leaks.

A value arrives as a function argument or a prop. The receiving file mirrors a shape it should not know about, and imports nothing at all.

```ts
seams: [{ generic: "engine", domain: ["domain"] }]
```

The vocabulary is derived rather than configured. A domain zone owns the names its files export, and the string values its sources contain.

Generic code that mentions one of those, with no import to explain why, is naming something it has no business naming. A new domain type is covered from the moment it exists. There is no list to keep in sync.

On a real app this found a component hardcoding `"stav"` where the domain exports `REQUISITION_STATUS = "stav"`, plus several hardcoding members of enums the domain declares.

Tune it with `allow` for words the two genuinely share, and `minLiteralLength` for short incidental strings.

## Directory size

```ts
maxFilesPerDirectory: 12
```

Boundaries govern what a file may reach. This governs where files pile up.

A directory that keeps growing has stopped being one idea. An agent adding the twenty-first file to a folder has no way to notice that from inside the file it is writing.

The count includes every file the analysis read, unclassified ones included. A directory nothing has claimed is the likeliest dumping ground.

There is no exemption list, because a limit with an exemption list is a limit nobody has to meet.

Line and function length are a linter's job, not this one's. Delegate them.

## The same thing written twice

```ts
duplication: 60
```

Every other rule here judges an edge that exists and should not. This one judges an edge that should exist and does not.

That gap is where an agent lives. It does not find what is already there, so it writes it again. Each copy is individually correct, three lines long, and passes review. Meanwhile the codebase grows a second answer to a question it had already answered.

Nothing else catches it. The copies are all used, so a dead-code checker sees nothing. They sit in different files, so a linter sees nothing. And they are far too small for a copy-paste detector to report without burying you.

### What it compares

The number is the shortest declaration worth reporting, in characters, with runs of whitespace collapsed to one space.

A declaration's **name is not part of the comparison**. A copy that was renamed on the way is still a copy, and renaming is exactly what happens when the second one is written from memory rather than pasted.

```
no-declaration-is-written-twice             3 errors
    src/zones/assign.ts:11:6      declares toPosix, which is written the same way in src/claims/isolation.ts, src/guard/protected.ts
    src/claims/isolation.ts:17:6  declares posix, which is written the same way in src/guard/protected.ts, src/zones/assign.ts
    src/guard/protected.ts:26:6   declares posix, which is written the same way in src/claims/isolation.ts, src/zones/assign.ts
```

Those three are real, and they are from this repository.

### Picking the number

Start around 60 and read what comes back. Lower finds more real duplication and more shared test scaffolding; higher finds only the large copies.

On this repository, 60 reports 28 and 100 reports 4. There is no default, because the right number depends on how much of your test setup you consider worth sharing.

Two findings that are not bugs are worth expecting. Fixture path constants repeated across test files are genuinely the same declaration, and you may decide that is fine. And two types can be structurally identical while meaning different things — when that happens they were two ideas wearing one shape, and the fix is to name them apart rather than to merge them.

## Code that crossed a boundary for one caller

```ts
colocation: true,
zones: [
  { name: "spec", patterns: ["**/*.test.ts", "**/*.fixture.ts"], role: "tests" },
  { name: "root", patterns: ["src/main.ts"], role: "wiring" },
  { name: "shared", patterns: ["packages/shared/**"] },
  { name: "web", patterns: ["apps/web/**"] },
]
```

A value exported from one zone and used by only one other zone is paying for a boundary that carries nothing a second caller needs.

A symbol in a shared package that exactly one app imports is not shared code. It is that app's code, in the wrong package. Move it there. A second consumer showing up later is a reason to move it back then, not a reason to have guessed now.

### Two exclusions, both load-bearing

**A zone with a `role` is never counted as the lone consumer.** Composition roots and test suites use other zones' code without ever being where that code belongs. A root wires each collaborator exactly once. A test imports whatever it exercises. Left in, they bury the real findings.

**Type-only edges are ignored.** A type gets used constantly without being imported — reading `record.exports[0].form` uses that type and names nothing. Import counts tell the truth about values and lie about types.

Measured on a 911-file monorepo: 758 findings unfiltered, 47 with both exclusions. Ten of those 47 were values in a shared package that only one app used, which is the case that counting files per symbol misses entirely.

### Exports that exist only for a test

Declaring a zone with `role: "tests"` also turns the question around.

Something that *only* the tests import is not shared code with one consumer. It is private code made public so a test could reach in.

```
no-export-exists-only-for-a-test          3 errors
    src/case/anchor.ts   exports EPOCH_START, which only tests use
    src/case/prompt.ts   exports CAST_RULES, which only tests use
    src/access/gate.ts   exports resourceAccess, which only tests use
```

The fix is to test the behaviour through the surface production code actually calls.

A helper that genuinely exists to serve tests belongs in the tests zone. Put `**/*.fixture.ts` in that zone and its false positives go with it — worth 39 of 169 findings on that monorepo.

Adding a production caller to satisfy the check is the one fix that makes the codebase worse. The printed guidance says so.

## Rules you write yourself

Config covers direction and vocabulary. Anything else is a plain TypeScript function over the project.

```ts
import { defineRule } from "trueline";

rules: [
  defineRule("domain-is-entered-through-its-index", (project) =>
    project
      .imports({ declaredZone: "domain" })
      .filter((edge) => edge.fromZone !== "domain" && !edge.via.endsWith("domain/index.ts"))
      .map((edge) => ({
        message: `reaches ${edge.imported} without going through the index`,
        file: edge.from,
        at: edge.at,
      })),
  ),
]
```

Each import arrives with its origin zone and its declaring zone already worked out. Alongside those come `via` (the module the import statement named), `symbol` and `kind`.

Return a list of issues. A message alone is enough, and severity defaults to `error`.

### Give the rule a remedy

A third argument says what a violation means and how to fix it. Whoever hits the rule reads that instead of guessing.

```ts
defineRule("domain-is-entered-through-its-index", check,
  "Something reached past the domain's index into a file behind it, which fixes that file's path and name for every caller. Export what the caller needs from the index and import it from there.")
```

Rules see a model of the project rather than a syntax tree. The parser stays an implementation detail you never have to learn.

## Using your existing linter alongside it

The rules here cover what a linter cannot express. Everything else is delegated. Those findings join the same report and the same baseline.

```ts
import { biomeRunner, eslintRunner, fallowRunner, oxlintRunner } from "trueline";

runners: [eslintRunner(), biomeRunner(), fallowRunner(), oxlintRunner()]
```

Each finding's category becomes its own claim — `eslint/no-unused-vars`, `biome/lint/suspicious/noDoubleEquals`, `fallow/unused_exports`. A baseline entry then pins one rule rather than a whole tool.

Each tool runs with your project root as its working directory, and keeps its own severities. A rule you set to `warn` stays a warning here.

Narrow any of them with `categories`. Biome matches by prefix, so `["lint"]` keeps every lint rule and drops formatter and config noise.

### Adapters distrust the tool they wrap

Unparseable output. An unexpected shape. A silent tool, a missing binary, a config error, a file the tool could not parse, a run that checked nothing.

Each of those fails the check rather than reporting nothing found. A tool that could not run is never recorded in a baseline.

The exit codes are worth knowing about, because none of them mean what you would guess. eslint exits `1` for "found problems" and saves `2` for a broken config. Biome and oxlint exit `1` whether they found problems or could not read the path at all, so those adapters read a count out of the payload instead of trusting the status.

### A note on oxlint

oxlint is worth knowing about if you are on TypeScript 7. `@typescript-eslint/parser` refuses to load against it, which takes eslint out of play for TypeScript entirely until that lands. oxlint carries its own parser, needs no TypeScript API, and implements most of the eslint rules — including the ones eslint has and biome does not, like `max-params`.

```ts
oxlintRunner({ paths: ["src"], categories: ["eslint/max-params"] })
```

### Letting biome fix what it can

```ts
biomeRunner({ write: process.env.CI === undefined })
```

Biome applies its safe fixes, and the report keeps only what it could not fix. The agent then spends its turns on findings that need judgement instead of on `let` versus `const`.

This is off by default, and worth keeping off in CI. A check that rewrites the tree is reporting on code that no longer matches what was committed. The config is TypeScript, so the environment decides.

Biome's unsafe fixes can change behaviour, and stay out of reach of this option. Pass `--unsafe` through `command` if you want them, knowing an agent will not notice a semantic change. `eslintRunner` takes `--fix` the same way.

### Catching a rule the agent silenced

```ts
eslintRunner({ reportSuppressed: true })
```

Every `// eslint-disable-next-line` becomes a finding under `eslint/suppressed/<rule>`, carrying its justification if one was written.

Existing suppressions go in the baseline. A new one fails.

This is the move an agent makes when told to get the build green. Without this it leaves no trace.

Delegated tools run on a full check only. The write-time guard skips them, since spawning a whole-repo lint on every edit costs far more than it catches.

## Exit codes

| code | meaning |
|---|---|
| `0` | clean |
| `1` | errors |
| `2` | the baseline holds entries whose violations are gone |
| `3` | no config found |

## Cost

A full check on a 900-file monorepo takes about a tenth of a second. The guard takes about the same, including process startup.

Identifiers are only read when a seam rule or a rule of your own asks for them. A run without either never builds a syntax tree.

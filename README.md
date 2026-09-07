# trueline

`trueline` keeps a TypeScript codebase in the shape you meant it to have, and stops a coding agent from quietly changing that shape.

It reads your source files without running them, works out which file depends on which, and compares that against rules you wrote down. When something breaks a rule, it says which file, what it did, and what to do about it.

## If you have never used a tool like this

A linter reads one file at a time and tells you about that file: an unused variable, a missing `await`. It is looking at the code *inside* a file.

`trueline` looks at the lines *between* files. Which parts of your project are allowed to know about which other parts. Where things live. Whether a folder has quietly become a junk drawer. None of that is visible from inside any single file, which is exactly why it goes wrong without anyone noticing.

You describe the shape once, in a config file. After that every run answers the same question: is this still true?

## Why this exists

An agent writing code optimises for the change in front of it. Reaching into another module is the shortest path to a working feature, so that is the path it takes. Every individual edit is defensible, the tests stay green, and after a hundred of them the project is a ball of mud that nobody chose.

You cannot review your way out of this — the whole point of the agent is that you are not reading every line. So the constraints have to be written down somewhere the agent runs into them, every time, without you.

That is what this is. And because a rule the agent can edit is a rule the agent will edit when it is under pressure to make the output green, every message it prints says the same thing: fix the code, not the rule.

## Start

Requires Node 22.18 or newer.

```
npm install --save-dev trueline
```

Create `architecture.config.ts` at the root of your project. This one says the project has four kinds of file, and that `engine` code may not reach into `domain` or `app`:

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

Then run it:

```
npx trueline
```

## Zones

A **zone** is a name for a group of files, chosen by path patterns. Zones are the vocabulary every other rule is written in, so this is the one idea worth getting right.

A file belongs to the first zone whose pattern matches it, so order them narrowest first. In the example above, `src/domain/user.test.ts` is `spec` rather than `domain`, because `spec` comes first.

Two things to know. Every file must land in some zone — a file in none is an error, not a shrug, because a file nothing has classified is a file no rule can govern. And put your tests in their own zone ahead of everything else; left inside a source zone, fixture text leaks into the other checks.

## Reading the output

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

The first two lines are a receipt. They exist so that a clean report cannot mean "I checked nothing" — if the file count or the edge count is wrong, you can see it before you trust the `ok`s.

Each line after that is a **claim**: a statement about the project that is either true, or true except for the counterexamples listed underneath. Every claim runs on every pass and the whole list always prints, so fixing one thing still tells you whether everything else moved.

Under the findings is the guidance for that claim — what the violation means and how to resolve it. It is written for whoever hits the rule without having read this file, which most of the time is the agent.

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
| `generic-code-names-no-domain-concept` | the seams hold |
| `no-directory-holds-too-many-files` | no directory has become a drawer |
| `no-value-is-declared-away-from-its-only-consumer` | nothing crosses a seam for a single caller |
| `no-export-exists-only-for-a-test` | nothing is public just so a test can reach it |
| `every-delegated-tool-ran` | every other analyzer you configured actually ran |

The first four are about the analysis itself, and they fail loudly on purpose. An import that does not resolve, a name no module exports, a pattern matching nothing — each of those means the tool is looking at less than you think it is, and a check that reports success while enforcing nothing is worse than no check at all.

## Boundaries, and why they follow the symbol

A boundary names a zone and the zones it may not reach:

```ts
boundaries: [
  { from: "engine", mayNotReach: ["domain"] },
  { from: "engine", mayNotReach: ["app"], ignoreTypeOnly: true },
]
```

Here is the part that makes this different from every other tool of its kind.

Most projects have a **barrel**: a file, usually `index.ts`, that re-exports everything from the modules around it so that consumers can import from one place. `import { Warrant } from "@app/shared"` is much nicer to write than a path six directories deep.

Barrels also make dependency rules useless. To a tool that reads import statements, every consumer of that package looks identical — they all import from `shared/index.ts`. A rule saying "components may not touch warrants" either matches every one of those imports or none of them, and neither is the truth.

`trueline` follows the re-export chain to the file that actually **declares** the thing you imported, and anchors the rule there. On a real monorepo, the same rule written both ways:

| anchored on | result |
|---|---|
| the file that declares the symbol | the four component files that reach `warrants.ts` |
| the module the import statement named | nothing at all |

The second row is where import-graph tools sit, including ones that resolve the barrel perfectly well. Resolving it is not the hard part. Attaching the rule to the symbol is.

Set `anchor: "imported-module"` when you do want the blunt version — "this package is off limits entirely" — and leave it alone for anything finer. `ignoreTypeOnly: true` exempts `import type`, for when you care that runtime code crossed rather than that a type name did.

## Blocking a bad edit before it happens

This is the part that matters most if you are working with an agent.

Claude Code can run a command before it writes a file, and cancel the write if that command objects. `trueline guard` is that command: it reads the proposed edit, applies it to a copy of the file in memory, and checks the *result* against the real project. The file never has to exist on disk.

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

The agent gets the refusal as its tool result, with the same explanation the report prints, and corrects course inside the same turn. Nothing lands on disk and no round trip through you is needed.

Only findings on the file being written can block it. Someone else's standing violation is not this edit's problem, and blocking on one would make every edit in an existing codebase impossible. Anything already in the baseline does not block either. An unusable payload, a missing config, a file type you do not analyse — all of those allow the write, because a guard that errors would block *every* edit rather than the wrong ones.

### Why there are two hooks

To judge an edit before it happens, the guard has to be able to work out what the file would look like afterwards. For a plain find-and-replace that is straightforward. For an edit expressed as "replace the body of this function", it is not — that needs the language server's idea of where the function starts and ends, which lives inside the editing tool, not here.

So tools whose result can be reproduced exactly are checked *before* the write and can be refused. Everything else is checked immediately *after* the write, against the real file, and comes back as a correction rather than a refusal. The guard never guesses at another tool's edit semantics; guessing is how this class of tool goes quietly wrong.

If you are not using Serena, the `Write|Edit` matcher alone covers everything and you can drop the second block.

## Telling the agent the rules up front

```
npx trueline agent-instructions >> CLAUDE.md
```

This prints a short block naming your zones, the two commands worth running, and the instruction that matters most: fix the code, not the rule. Blocking an edit teaches the agent one rule at a time, at the moment it breaks it. This teaches it the shape before it starts.

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

Useful to you when you are deciding where something goes, and useful to an agent that has been told to run it before creating a file. A path in no zone is reported as such, which is the answer you want before making a directory nothing covers.

## Adopting on a codebase that already breaks the rules

Almost nobody starts clean. Record what is already there, then hold the line:

```
npx trueline --update-baseline
```

The **baseline** is a file listing the violations that existed when you started. From then on a new violation fails the build, while a recorded one prints as a warning — visible, not hidden, so nobody forgets the debt is there.

If you fix something that was in the baseline, the run exits `2` and tells you to update it. That sounds fussy and is the entire point: without it a baseline slowly turns into a list of permanent exemptions that nobody dares delete.

Entries are keyed on the claim, the file and the message — never on a line number — so moving code around does not churn the file. And a run where nothing was analysed can never be recorded, so a broken config cannot silently baseline your whole project.

## Seams: catching what an import cannot

A boundary catches a bad import. It cannot catch the other way domain knowledge leaks: a value arriving as a function argument or a prop, where the receiving file mirrors a shape it should not know about and imports nothing at all.

```ts
seams: [{ generic: "engine", domain: ["domain"] }]
```

The vocabulary is derived rather than configured. A domain zone owns the names its files export and the string values its sources contain. Generic code that mentions one of those, with no import to explain why, is naming something it has no business naming. A new domain type is covered from the moment it exists — there is no list to keep in sync.

On a real app this found a component hardcoding `"stav"` where the domain exports `REQUISITION_STATUS = "stav"`, plus several hardcoding members of enums the domain declares. Tune it with `allow` for words the two genuinely share, and `minLiteralLength` for short incidental strings.

## Directory size

```ts
maxFilesPerDirectory: 12
```

Boundaries govern what a file may reach. This governs where files pile up. A directory that keeps growing has stopped being one idea, and an agent adding the twenty-first file to a folder has no way to notice that from inside the file it is writing.

The count includes every file the analysis read, unclassified ones included — a directory nothing has claimed is the likeliest dumping ground. There is no exemption list, because a limit with an exemption list is a limit nobody has to meet.

Line and function length are a linter's job, not this one's. Delegate them.

## Code that crossed a boundary for exactly one caller

```ts
colocation: true,
zones: [
  { name: "spec", patterns: ["**/*.test.ts", "**/*.fixture.ts"], role: "tests" },
  { name: "root", patterns: ["src/main.ts"], role: "wiring" },
  { name: "shared", patterns: ["packages/shared/**"] },
  { name: "web", patterns: ["apps/web/**"] },
]
```

A value exported from one zone and used by only one other zone is paying for a seam that carries nothing a second caller needs. A symbol in a shared package that exactly one app imports is not shared code — it is that app's code, in the wrong package. Move it there. A second consumer showing up later is a reason to move it back then, not a reason to have guessed now.

Two exclusions make this precise instead of noisy, and both are load-bearing.

**A zone with a `role` is never counted as the lone consumer.** Composition roots and test suites use other zones' code without ever being where that code belongs — a root wires each collaborator exactly once, and a test imports whatever it exercises. Left in, they bury the real findings.

**Type-only edges are ignored**, because a type gets used constantly without being imported: reading `record.exports[0].form` uses that type and names nothing. Import counts tell the truth about values and lie about types.

Measured on a 911-file monorepo: 758 findings unfiltered, 47 with both exclusions — of which 10 were values in a shared package that only one app used, the case that counting files per symbol misses entirely.

### Exports that exist only for a test

Declaring a zone with `role: "tests"` also turns the question around. Something that *only* the tests import is not shared code with one consumer. It is private code that was made public so a test could reach in:

```
no-export-exists-only-for-a-test          3 errors
    src/case/anchor.ts   exports EPOCH_START, which only tests use
    src/case/prompt.ts   exports CAST_RULES, which only tests use
    src/access/gate.ts   exports resourceAccess, which only tests use
```

The fix is to test the behaviour through the surface production code actually calls. A helper that genuinely exists to serve tests belongs in the tests zone — put `**/*.fixture.ts` in that zone and its false positives go with it, worth 39 of 169 findings on that monorepo.

Adding a production caller to satisfy the check is the one fix that makes the codebase worse, and the printed guidance says so.

## Rules you write yourself

Config covers direction and vocabulary. Anything else is a plain TypeScript function over the project:

```ts
import { defineRule } from "trueline";

rules: [
  defineRule("no-two-zones-import-each-other", (project) => {
    const reaches = new Map<string, Set<string>>();
    for (const edge of project.imports()) {
      if (edge.fromZone === null || edge.declaredZone === null) continue;
      if (edge.fromZone === edge.declaredZone) continue;
      reaches.set(edge.fromZone, (reaches.get(edge.fromZone) ?? new Set()).add(edge.declaredZone));
    }

    return [...reaches].flatMap(([zone, targets]) =>
      [...targets]
        .filter((target) => zone < target && reaches.get(target)?.has(zone) === true)
        .map((target) => ({ message: `zones ${zone} and ${target} import each other` })),
    );
  }),
]
```

Each import arrives with its origin zone and its declaring zone already worked out, alongside `via` (the module the import statement named), `symbol` and `kind`. Return a list of issues; a message alone is enough, and severity defaults to `error`.

Pass a third argument to say what a violation means and how to fix it. Whoever hits the rule reads that instead of guessing:

```ts
defineRule("no-two-zones-import-each-other", check,
  "Two zones import each other, so neither can be understood or moved alone. Decide which owns the shared concept and give the other a one-way dependency on it.")
```

Rules see a model of the project rather than a syntax tree, so the parser stays an implementation detail you never have to learn.

## Using your existing linter alongside it

The rules here cover what a linter cannot express. Everything else is delegated, and those findings join the same report and the same baseline:

```ts
import { biomeRunner, eslintRunner, fallowRunner } from "trueline";

runners: [eslintRunner(), biomeRunner(), fallowRunner()]
```

Each finding's category becomes its own claim — `eslint/no-unused-vars`, `biome/lint/suspicious/noDoubleEquals`, `fallow/unused_exports` — so a baseline entry pins one rule rather than a whole tool. Each tool runs with your project root as its working directory and keeps its own severities, so a rule you set to `warn` stays a warning here. Narrow any of them with `categories`; biome matches by prefix, so `["lint"]` keeps every lint rule and drops formatter and config noise.

An adapter distrusts the tool it wraps. Unparseable output, an unexpected shape, a silent tool, a missing binary, a config error, a file the tool could not parse, a run that checked nothing — each fails the check rather than reporting nothing found, and a tool that could not run is never recorded in a baseline.

The exit codes are worth knowing about, because none of them mean what you would guess. eslint exits `1` for "found problems" and saves `2` for a broken config. biome exits `1` whether it found problems or could not read the path at all, so the adapter reads its summary instead of its status.

### Letting biome fix what it can

```ts
biomeRunner({ write: process.env.CI === undefined })
```

Biome applies its safe fixes and the report keeps only what it could not fix. The agent then spends its turns on findings that need judgement instead of on `let` versus `const`.

Off by default, and worth keeping off in CI — a check that rewrites the tree is reporting on code that no longer matches what was committed. The config is TypeScript, so the environment decides. Biome's unsafe fixes can change behaviour and stay out of reach of this option; pass `--unsafe` through `command` if you want them, knowing an agent will not notice a semantic change. `eslintRunner` takes `--fix` the same way.

### Catching a rule the agent silenced

```ts
eslintRunner({ reportSuppressed: true })
```

Every `// eslint-disable-next-line` becomes a finding under `eslint/suppressed/<rule>`, carrying its justification if one was written. Existing suppressions go in the baseline; a new one fails.

This is the move an agent makes when told to get the build green, and without this it leaves no trace.

Delegated tools run on a full check only. The write-time guard skips them, since spawning a whole-repo lint on every edit costs far more than it catches.

## Exit codes

`0` clean · `1` errors · `2` the baseline holds entries whose violations are gone · `3` no config found

## Cost

A full check on a 900-file monorepo takes about a tenth of a second, and the guard about the same including process startup. Identifiers are only read when a seam rule or a rule of your own asks for them, so a run without either never builds a syntax tree.

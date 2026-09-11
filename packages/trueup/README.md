# trueup

trueup keeps a TypeScript codebase in the shape you meant it to have, and stops a coding agent from quietly changing that shape.

It reads your source files without running them, works out which file depends on which, and compares that against rules you wrote down. When something breaks a rule, it names the file, says what happened, and says what to do about it.

## It reads between files, not inside them

A linter reads one file at a time and tells you about that file. A variable nobody uses. A keyword you forgot.

trueup looks at the lines between files instead. Which parts of your project are allowed to know about which other parts. Where a file should live. Whether a folder has quietly turned into a junk drawer. None of that can be seen from inside any single file, which is why the shape of a project drifts for months and nobody notices.

You describe the shape once. Every run after that answers a single question: is this still true?

## Getting started

You need Node 22.18 or newer.

```sh
npm install --save-dev @vismek-solutions/trueup
```

Let it write a first draft of the rules by reading your folders:

```sh
npx trueup init
```

That draft gives you zones, which are names for groups of files. What it will not guess is which zones may reach which, because a folder layout cannot say which direction the dependencies are meant to run. That part is yours:

```ts
// trueup.config.ts
import { defineConfig } from "@vismek-solutions/trueup";

export default defineConfig({
  zones: [
    { name: "spec", patterns: ["**/*.test.ts"] },
    { name: "components", patterns: ["src/components/**"] },
    { name: "hooks", patterns: ["src/hooks/**"] },
    { name: "api", patterns: ["src/api/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "app", patterns: ["src/**"] },
    { name: "server", patterns: ["server/**"] },
  ],
  boundaries: [
    { from: "components", allow: ["hooks", "api"] },
    { from: "hooks", allow: ["api"] },
    { from: "api", allow: [] },
  ],
});
```

Then run it:

```sh
npx trueup
```

Every finding arrives with an explanation of what it means and how to resolve it:

```
every-import-respects-its-zone-boundary     1 error
    src/hooks/useCart.ts:1:10  is hooks and may not reach components: CartRow from src/components/CartRow.tsx
    Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its
    declaring file, so a barrel in between does not excuse it.

    Do this:
    - Move the code to a zone that may reach the target.
    - Or have the target expose what the caller needs through a zone the caller may reach.
    - Run `trueup explain <file>` to see what a file may reach.

    Not the fix: widening the rule so the edge becomes legal.
```

It exits with a failure code whenever there is something to fix, so a CI step needs no extra flags.

## What it checks

Rules you write, in one config file:

- which zones may reach which, anchored on the file where a name is really written, so a barrel in between changes nothing
- sibling directories kept apart by one pattern, so a new one is covered the moment it exists
- reusable code kept clear of the words your domain owns, even when no import connects them
- where a file belongs, judged by who actually reads it
- the same declaration written twice, compared with its name stripped off
- how large a change may grow before nobody can really review it
- anything else, as a plain TypeScript function over the resolved project

Checks that need nothing from you but zones:

- every import resolves, and every name you imported is really in the module it came from
- no name arrives ambiguously through two different re-export chains
- every file lands in a zone, no zone is empty, and no pattern is dead
- no group of zones depends on itself

A check that reports success while enforcing nothing is worse than no check at all, so an empty or degraded input is an error here rather than a pass.

## Stopping a bad edit

Claude Code can run a command before it writes a file and cancel the write if that command objects. Put this in .claude/settings.json and the agent gets the refusal as its tool result, with the reason it needs to correct course in the same turn:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "npx trueup guard" }]
      }
    ]
  }
}
```

Nothing lands on disk, and no trip through you is needed. The rules themselves are protected too, because an agent told to make the build pass will widen a rule as readily as fix the code.

## Almost nobody starts clean

Record what is already there, then hold the line from that point:

```sh
npx trueup --update-baseline
```

A new violation fails the build after that. A recorded one prints as a warning, so nobody forgets the debt is there.

## Full documentation

The guides ship with the package, so you can read them without leaving the terminal and without a browser:

```sh
npx trueup docs
```

That lists every page with a line about each. Name one and it prints in full, and a claim name from a failing run works in the same place:

```sh
npx trueup docs seams
```

The same guides live in [apps/docs](../../apps/docs/src/content/docs), and cover the parts this page only mentions.

- [Getting started](../../apps/docs/src/content/docs/start/getting-started.md), the same ten minutes in more detail
- [Zones](../../apps/docs/src/content/docs/concepts/zones.md), the one idea everything else is built on
- [Boundaries](../../apps/docs/src/content/docs/concepts/boundaries.md), including why barrels defeat other tools
- [Reading a report](../../apps/docs/src/content/docs/start/reports.md), and the quieter output modes
- [Everything it checks](../../apps/docs/src/content/docs/checks/index.md), claim by claim
- [The write time guard](../../apps/docs/src/content/docs/agents/guard.md), in full
- [Starting on code you already have](../../apps/docs/src/content/docs/agents/baseline.md)
- [Keeping the linter you already have](../../apps/docs/src/content/docs/integrations/linters.md)
- [Monorepos](../../apps/docs/src/content/docs/concepts/monorepos.md), where each package keeps its own rules
- [Configuration](../../apps/docs/src/content/docs/reference/config.md), every key and every command

## How this is tested

The suite is checked with [Stryker](https://stryker-mutator.io), which changes one thing in the source at a time and runs the tests again. A test that executes a branch without asserting anything about it lets the change through, so it counts as a gap here rather than as coverage.

That is the same failure this tool exists to catch between files, turned back on the tests themselves.

## Cost

A full check on a 900-file monorepo takes about a tenth of a second. The guard takes about the same, including the time to start the process.

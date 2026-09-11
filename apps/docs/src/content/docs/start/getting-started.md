---
title: Getting started
description: Install trueup, write down the shape of your project in one file, and run it.
---

This takes about ten minutes on an ordinary project. You need Node 22.18 or newer.

Install it as a development dependency:

```sh
npm install --save-dev @vismek-solutions/trueup
```

Then let it write a first draft of your rules for you:

```sh
npx trueup init
```

```
wrote trueup.config.ts

zones     spec · api · domain · app
runners   biomeRunner · eslintRunner, over test · src only

next      add `boundaries` to say which zones may reach which
          turn on `colocation`, `duplication` and `maxFilesPerDirectory` once a first run is clean
          run `trueup` to see what it finds
```

That draft comes from your folders, not from your intentions. You get one zone for each top level source folder, one for wherever your tests live, and a catch all at the end that sweeps up whatever the others missed. A zone is a name you give to a group of files, and the next page explains them properly.

Every pattern it writes matches at least one real file. A pattern that matches nothing is a rule you believe you have and do not, so it will not write one.

It also wires up the linters your project already installs, so their findings come back inside the same report. Each one is pointed at the directories your zones cover, because told to check the whole current folder, oxlint and biome would lint everything inside node_modules too.

Nothing is overwritten if a config file is already sitting there, and in a workspace every package gets [a rulebook of its own](/concepts/monorepos/#starting-from-the-workspace).

There is one thing it will not guess, and that is the boundaries. A folder layout cannot tell anybody which direction the dependencies are meant to run. That part is yours to write, and it is the part worth thinking about.

The rest of this page uses a config with those filled in:

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

Then run it.

```sh
npx trueup
```

```
coverage  9 files · 6 edges · 6 symbol · 0 external · 0 builtin · 0 unresolved
zones     spec 1 · components 2 · hooks 1 · api 1 · domain 1 · app 1 · server 1 · 1 unclassified

the-analysis-reached-files                  ok
every-import-resolves                       ok
every-imported-name-is-exported             ok
every-imported-name-is-unambiguous          ok
every-file-belongs-to-a-zone                1 error
    scripts/seed.ts  scripts/seed.ts matches no zone
    ────────
    A file matches no zone, so no boundary or seam rule applies to it.

    Do this:
    - Move it under an existing zone.
    - Or declare a zone that covers it.
    - Run `trueup explain <file>` to see what a location would allow.

every-zone-has-a-file                       ok
every-zone-pattern-matches-a-file           ok
every-rule-names-a-declared-zone            ok
every-import-respects-its-zone-boundary     1 error
    src/hooks/useCart.ts:1:10  is hooks and may not reach components: CartRow from src/components/CartRow.tsx
    ────────
    Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its
    declaring file, so a barrel in between does not excuse it.

    Do this:
    - Move the code to a zone that may reach the target.
    - Or have the target expose what the caller needs through a zone the caller may reach.
    - Run `trueup explain <file>` to see what a file may reach.

    Not the fix: widening the rule so the edge becomes legal.

generic-code-names-no-domain-concept        ok
no-zones-form-a-cycle                       ok

11 claims · 2 errors · 0 warnings
```

Those two findings are the two kinds this tool exists to show you. One is a file that no zone claims, so no rule is watching it. The other is a line between two parts of the project that you did not know was being crossed.

## Reading that config

Every pattern is matched against a file's location **relative to your project root**, which is the folder holding your config file.

The zones say this project has seven kinds of file. The names are yours to invent and none of them are reserved. For a first pass, take one zone per top level folder inside your source directory, plus one for tests. Then merge any two zones you would never write a rule between.

Order matters, because a file belongs to the **first** zone that matches it. The test zone is listed first, so a test sitting inside the components folder counts as a test rather than as a component. The catch all zone is listed last and picks up everything under the source directory that no earlier zone claimed.

The boundaries here say that components may reach hooks and the api, hooks may reach the api, and the api may reach nothing at all. A zone can always reach itself, so it never has to say so. And a zone with no rule of its own is unrestricted, which here means the catch all zone, the server zone and the test zone. That is what lets you add rules one zone at a time instead of all at once.

## What it will not complain about

**Short import paths work on their own.** If your tsconfig.json maps a prefix to a folder, an import written with that prefix resolves, with or without a file extension. There is nothing for you to set up.

```ts
import { Button } from "@/components/Button";
```

**Imports of things that are not code are fine.** A stylesheet, an image, a data file: each of these counts as coming from outside your source, and none of them is ever reported.

```ts
import "./App.css";
import logo from "./logo.svg";
import data from "./config.json";
```

Only files with a source extension are read and sorted into zones. For everything else the trail simply stops there.

If something genuinely fails to resolve, it is one of two things. Either a real typo, which you want to know about, or an import name that your build tool invents out of thin air. The second case is covered in [imports your build tool supplies](/concepts/boundaries/#imports-your-build-tool-supplies).

If that first run turns up problems you cannot fix this week, you are in very good company. Write them down with [a baseline](/agents/baseline/) and hold the line from there. Weakening a rule is the one move we would ask you not to make.

## Running it in CI

```json
{ "scripts": { "lint:arch": "trueup" } }
```

Then run that script as a step in your pipeline. It exits with a failure code whenever there is something to fix, so no extra flags are needed.

One exit code is likely to surprise you the first time you meet it. If you fix a violation that the baseline had recorded, the run fails with code 2. It keeps failing until somebody updates the baseline and commits the result:

```sh
npx trueup --update-baseline
```

That sounds fussy, and it is on purpose. Without it, a baseline slowly turns into a list of exemptions nobody dares to delete. [The full table of exit codes is here](/start/reports/#exit-codes).

## What to do next

- [Zones](/concepts/zones/), which is the one idea everything else is built on.
- [The write time guard](/agents/guard/), if an agent writes code in this repository. It is the only part that stops a violation instead of reporting it.
- [Your existing linter](/integrations/linters/), so that one command and one exit code cover everything.

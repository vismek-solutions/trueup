---
title: Getting started
description: Install trueup, write a config that describes your project's shape, and run it.
---

Requires Node 22.18 or newer.

```sh
npm install --save-dev trueup
```

Then write a starting config:

```sh
npx trueup init
```

```
wrote trueup.config.ts

zones     spec · api · domain · app
runners   biomeRunner · fallowRunner

next      add `boundaries` to say which zones may reach which
          turn on `colocation`, `duplication` and `maxFilesPerDirectory` once a first run is clean
          run `trueup` to see what it finds
```

It reads the tree, not your intentions: one zone per top-level folder under `src`, one for wherever your tests live, and a catch-all last. Runners are wired for the linters your `package.json` already has, scoped to the directories the zones cover. Nothing is written if a config is already there, and in a workspace each package gets [a rulebook of its own](/concepts/monorepos/#starting-from-the-workspace).

What it will not guess is `boundaries`, because a folder layout does not say which direction the dependencies are meant to run. That is the part you write. The rest of this page uses a config with those filled in:

```ts
// trueup.config.ts
import { defineConfig } from "trueup";

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
    A file matches no zone, so no boundary or seam rule applies to it. Move it under an existing
    zone, or declare a zone that covers it. Run `trueup explain <file>` to see what a location
    would allow.

every-zone-has-a-file                       ok
every-zone-pattern-matches-a-file           ok
every-rule-names-a-declared-zone            ok
every-import-respects-its-zone-boundary     1 error
    src/hooks/useCart.ts:1:10  is hooks and may not reach components: CartRow from src/components/CartRow.tsx
    Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its
    declaring file, so a barrel in between does not excuse it. Move the code to a zone that may
    reach the target, or have the target expose what the caller needs through a zone it may reach.
    Run `trueup explain <file>` to see what a file may reach. Widening the rule is not the fix.

generic-code-names-no-domain-concept        ok
no-zones-form-a-cycle                       ok

11 claims · 2 errors · 0 warnings
```

Those two findings are the two kinds this exists to show you: a file no zone claims, and a boundary you did not know was being crossed.

## Reading that config

Every path pattern is matched against the file's path **relative to your project root** — the directory holding `trueup.config.ts`.

The zones say the project has seven kinds of file. Names are yours to invent; nothing is reserved. A good first pass: one zone per top-level folder under `src`, plus one for tests. Then merge any two zones you would never write a rule between.

Order matters, because a file belongs to the **first** zone that matches it. `spec` comes first so a test inside `src/components` is a test rather than a component. `app` comes last as a catch-all for everything under `src` no earlier zone claimed.

The boundaries say `components` may reach `hooks` and `api`, `hooks` may reach `api`, and `api` may reach nothing. A zone always reaches itself, and a zone with no rule of its own — `app`, `server`, `spec` here — is unrestricted. So you can add rules one zone at a time.

## What it will not complain about

**Path aliases resolve on their own.** `import { Button } from "@/components/Button"` works if `@/*` is mapped in your `tsconfig.json`, with or without a file extension. There is nothing to configure.

**Imports of non-source files are fine.** `import "./App.css"`, `import logo from "./logo.svg"` and `import data from "./config.json"` are counted as external and never reported. Only files with a source extension are read and zoned; everything else is a leaf.

If something genuinely does not resolve — a real typo, or a specifier your bundler invents — see [imports your build tool supplies](/concepts/boundaries/#imports-your-build-tool-supplies).

If the codebase already has violations you cannot fix today, record them with [a baseline](/agents/baseline/) rather than weakening a rule.

## Running it in CI

```json
{ "scripts": { "lint:arch": "trueup" } }
```

Then run `npm run lint:arch` as a CI step. It exits non-zero when there is anything to fix, so no extra flags are needed.

One exit code will surprise you. Fixing a violation that was in the baseline exits `2`. The build fails until someone runs `npx trueup --update-baseline` and commits the result. Without that, the baseline slowly turns into a list of exemptions nobody dares delete. [The full table is here](/start/reports/#exit-codes).

## What to do next

- [Zones](/concepts/zones/) — the one concept everything else is built on.
- [The write-time guard](/agents/guard/), if an agent writes code in this repository. It is the only part that stops a violation instead of reporting it.
- [Your existing linter](/integrations/linters/), so one command and one exit code cover everything.

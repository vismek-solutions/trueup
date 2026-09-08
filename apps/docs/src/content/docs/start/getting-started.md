---
title: Getting started
description: Install trueline, write a config that describes your project's shape, and run it.
---

Requires Node 22.18 or newer.

```sh
npm install --save-dev trueline
```

Create `trueline.config.ts` at the root of your project, next to `package.json`.

```ts
import { defineConfig } from "trueline";

export default defineConfig({
  zones: [
    { name: "spec", patterns: ["**/*.test.ts", "**/*.test.tsx"] },
    { name: "components", patterns: ["src/components/**"] },
    { name: "hooks", patterns: ["src/hooks/**"] },
    { name: "api", patterns: ["src/api/**"] },
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
npx trueline
```

## Reading that config

Every path pattern is matched against the file's path **relative to your project root** — the directory holding `trueline.config.ts`.

The zones say the project has six kinds of file. Names are yours to invent; nothing is reserved. A good first pass is one zone per top-level folder under `src`, plus one for tests, then merge any two you would never write a rule between.

Order matters, because a file belongs to the **first** zone that matches it. `spec` comes first so a test inside `src/components` is a test rather than a component. `app` comes last as a catch-all for everything under `src` no earlier zone claimed.

The boundaries say `components` may reach `hooks` and `api`, `hooks` may reach `api`, and `api` may reach nothing. A zone always reaches itself, and a zone with no rule of its own — `app`, `server`, `spec` here — is unrestricted. So you can add rules one zone at a time.

## What the first run will tell you

On an existing codebase the first run usually reports files in no zone, and boundaries you did not know were being crossed. Both are the point.

Two things it will **not** complain about, which are worth knowing before you start:

**Path aliases resolve on their own.** `import { Button } from "@/components/Button"` works if `@/*` is mapped in your `tsconfig.json`, with or without a file extension. There is nothing to configure.

**Imports of non-source files are fine.** `import "./App.css"`, `import logo from "./logo.svg"` and `import data from "./config.json"` are counted as external and never reported. Only files with a source extension are read and zoned; everything else is a leaf.

If something genuinely does not resolve — a real typo, or a specifier your bundler invents — see [imports your build tool supplies](/concepts/boundaries/#imports-your-build-tool-supplies).

If the codebase already has violations you cannot fix today, record them with [a baseline](/agents/baseline/) rather than weakening a rule.

## Running it in CI

```json
{ "scripts": { "lint:arch": "trueline" } }
```

Then run `npm run lint:arch` as a CI step. It exits non-zero when there is anything to fix, so no extra flags are needed.

One exit code is worth knowing about in advance. If someone **fixes** a violation that was recorded in the baseline, the run exits `2` and asks for the baseline to be updated — which fails the build until they run `npx trueline --update-baseline` and commit the result. That is deliberate: without it the baseline slowly turns into a list of exemptions nobody dares delete. [The full table is here](/start/reports/#exit-codes).

## What to do next

- [Zones](/concepts/zones/) — the one concept everything else is built on.
- [The write-time guard](/agents/guard/), if an agent writes code in this repository. It is the only part that stops a violation instead of reporting it.
- [Your existing linter](/integrations/linters/), so one command and one exit code cover everything.

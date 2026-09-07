---
title: Getting started
description: Install trueline, write a config that describes your project's shape, and run it.
---

Requires Node 22.18 or newer.

```sh
npm install --save-dev trueline
```

Create `trueline.config.ts` at the root of your project.

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

That says the project has four kinds of file, and that `engine` code may not reach into `domain` or `app`.

Then run it.

```sh
npx trueline
```

## What to do next

The config above is enough to get a real answer, and the answer is usually that a zone is missing or a boundary is drawn in the wrong place. That is the point: [zones](/concepts/zones/) are the vocabulary every other rule is written in, so they are the thing worth getting right before adding anything else.

Once the report is clean, three additions earn their keep quickly:

- [The write-time guard](/agents/guard/), if an agent writes code in this repository. It is the only part that stops a violation instead of reporting it.
- [A baseline](/agents/baseline/), if the codebase already has violations. It records them as warnings so new ones can fail.
- [Your existing linter](/integrations/linters/), so one command and one exit code cover everything.

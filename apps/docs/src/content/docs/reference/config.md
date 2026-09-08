---
title: Configuration
description: Every key the config file accepts.
---

The config is TypeScript. It is discovered by walking upward for `trueup.config.ts`, `.js` or `.mjs`, and the directory holding it is the project root. `npx trueup init` writes a first one from the shape of your tree.

Because it is TypeScript, it can read the environment — useful for anything that should behave differently in CI.

```ts
// trueup.config.ts
import { defineConfig, oxlintRunner } from "trueup";

export default defineConfig({
  zones: [
    { name: "spec", patterns: ["**/*.test.ts"], role: "tests" },
    { name: "components", patterns: ["src/components/**"] },
    { name: "hooks", patterns: ["src/hooks/**"] },
    { name: "api", patterns: ["src/api/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "app", patterns: ["src/**"], role: "wiring" },
  ],
  boundaries: [
    { from: "components", allow: ["hooks", "api"] },
    { from: "hooks", allow: ["api"] },
    { from: "api", allow: [] },
  ],
  seams: [{ generic: "components", domain: ["domain"] }],
  colocation: true,
  maxFilesPerDirectory: 12,
  runners: [oxlintRunner({ paths: ["src"] })],
});
```

Everything below `zones` is optional. A config with zones alone still runs nine claims.

## Root config

| key | type | default | effect |
|---|---|---|---|
| `zones` | `ZoneDefinition[]` | required unless `members` is used | The vocabulary. |
| `boundaries` | `BoundaryRule[]` | none | Which zones each zone may reach. |
| `seams` | `SeamRule[]` | none | [Domain leaks with no import](/checks/seams/). |
| `isolate` | `IsolationRule[]` | none | [Sibling directories](/checks/isolation/) kept apart. |
| `rules` | `Rule[]` | none | [Rules you write yourself](/checks/custom-rules/). |
| `runners` | `Runner[]` | none | [Delegated tools](/integrations/linters/). |
| `members` | `string[]` | none | Globs naming [monorepo members](/concepts/monorepos/). |
| `include` | `string[]` | the whole project | Directories to scan. Narrowing this removes files from every check. |
| `extensions` | `string[]` | `.ts .tsx .mts .cts .js .jsx .mjs .cjs` | Replaces that list rather than adding to it. |
| `externals` | `string[]` | none | [Specifiers your build tool supplies](/concepts/boundaries/#imports-your-build-tool-supplies). |
| `ignoreDirectories` | `string[]` | `.git node_modules dist build out coverage .next .turbo` | Directory basenames never walked into. Replaces the list. |
| `protect` | `string[]` or `{ paths?, decision? }` | the config and the baseline, always | [Extra paths an agent may not edit](/agents/guard/#the-rulebook-goes-through-you). |
| `maxFilesPerDirectory` | `number` | off | [Directory size limit](/checks/placement/#directory-size). |
| `duplication` | `number` | off | [Shortest declaration worth reporting](/checks/duplication/), in characters. |
| `colocation` | `boolean` | `false` | Turns on [the placement claims](/checks/placement/). |
| `testInternals` | `boolean` | `false` | Turns on [the check for a test reaching an internal](/checks/placement/#tests-that-reach-an-internal). |
| `command` | `string` | `trueup` | The command named in printed guidance. Set it to `pnpm lint:arch` and every message says that. |

## Zones

```ts
{ name: string, patterns: string[], role?: "wiring" | "tests" | "api" }
```

First match wins, in declaration order. [What each role changes](/concepts/zones/#roles).

## Boundaries

```ts
{ from: string, allow: string[], anchor?: "declaring-file" | "imported-module", ignoreTypeOnly?: boolean }
```

`allow` is an allowlist: anything not listed is refused, a zone always reaches itself, and a zone with no rule is unrestricted. Several rules for one zone intersect.

`anchor` defaults to `declaring-file`: the rule attaches to the file that declares the symbol, not to the module you imported. [The blunt alternative](/concepts/boundaries/#two-options-on-a-boundary).

## Seams

```ts
{ generic: string, domain: string[], allow?: string[], minLiteralLength?: number }
```

`minLiteralLength` defaults to 4.

## Isolation

```ts
{ siblings: string, except?: string[] }
```

`siblings` is a glob whose `*` groups name the islands. `except` holds those names — the directory names the `*` matched, not paths — so `except: ["_shared"]` exempts `src/routes/_shared` under `siblings: "src/routes/*"`.

## Members

```ts
// packages/lib/trueup.config.ts
export default defineMember({
  zones, allow?, boundaries?, seams?, rules?, maxFilesPerDirectory?, doorsFromExports?
})
```

`doorsFromExports` derives the member's api zone from `package.json#exports` instead of you declaring one. [When that works and when it does not](/concepts/monorepos/#the-door-is-written-down-twice).

A member's `rules` receive a project narrowed to that member — its own files, its own zone names unqualified — and their findings are reported under `<member>/<rule>`. [What that means for a rule spanning packages](/concepts/monorepos/#rules-that-belong-to-one-package).

Runners, `externals`, `protect`, `command`, `isolate` and `duplication` stay at the root, because they are properties of the repository rather than of a package.

## Protection

```ts
protect: ["CLAUDE.md"]
protect: { paths: ["CLAUDE.md"], decision: "deny" }
```

The root config, every member config and the baseline are covered with no configuration at all. `decision` is `"ask"`, `"deny"` or `"allow"`. It defaults to a permission prompt, and is downgraded to a refusal automatically wherever no person would see the prompt.

`"allow"` hands the rulebook to the agent in every mode, and every run then prints a `notice` line saying so. [What that gives up](/agents/guard/#handing-the-rulebook-over).

## Command line

| | |
|---|---|
| `npx trueup init` | write a starting config, and one per workspace package |
| `npx trueup` | the full report |
| `npx trueup --dots` | one character per claim |
| `npx trueup --next` | one problem, then stop |
| `npx trueup --json` | machine-readable |
| `npx trueup --gitlab` | [GitLab Code Quality](/start/reports/#on-a-gitlab-merge-request) |
| `npx trueup --update-baseline` | record current violations |
| `npx trueup --config=<path>` | use a specific config |
| `npx trueup explain <path>` | what a file may reach |
| `npx trueup agent-instructions` | a block to append to `CLAUDE.md` |
| `npx trueup guard` | read a hook payload on stdin |

An argument outside this list is an error, not something to ignore.

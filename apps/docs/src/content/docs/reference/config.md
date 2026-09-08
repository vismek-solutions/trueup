---
title: Configuration
description: Every key the config file accepts.
---

The config is TypeScript. It is discovered by walking upward for `trueline.config.ts`, `.js` or `.mjs`, and the directory holding it is the project root.

Because it is TypeScript, it can read the environment — useful for anything that should behave differently in CI.

## Root config

| key | type | effect |
|---|---|---|
| `zones` | `ZoneDefinition[]` | The vocabulary. Required unless `members` is used. |
| `boundaries` | `BoundaryRule[]` | Which zones each zone may reach. |
| `seams` | `SeamRule[]` | [Domain leaks with no import](/checks/seams/). |
| `isolate` | `IsolationRule[]` | [Sibling directories](/checks/isolation/) kept apart. |
| `rules` | `Rule[]` | [Rules you write yourself](/checks/custom-rules/). |
| `runners` | `Runner[]` | [Delegated tools](/integrations/linters/). |
| `members` | `string[]` | Globs naming [monorepo members](/concepts/monorepos/). |
| `include` | `string[]` | Scan roots. Absent means the whole repo, which is stricter. |
| `extensions` | `string[]` | Overrides the default source extensions. |
| `externals` | `string[]` | [Specifiers your build tool supplies](/concepts/boundaries/#imports-your-build-tool-supplies). |
| `ignoreDirectories` | `string[]` | Directory basenames never walked into. |
| `protect` | `string[]` or object | [Extra paths an agent may not edit](/agents/guard/#the-rulebook-goes-through-you). |
| `maxFilesPerDirectory` | `number` | [Directory size limit](/checks/placement/#directory-size). |
| `duplication` | `number` | [Shortest declaration worth reporting](/checks/duplication/), in characters. |
| `colocation` | `boolean` | Turns on [both placement claims](/checks/placement/). |
| `command` | `string` | How the tool is invoked, substituted into printed guidance. |

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

`anchor` defaults to `declaring-file`, which is the point of the tool. [The blunt alternative](/concepts/boundaries/#two-options-on-a-boundary).

## Seams

```ts
{ generic: string, domain: string[], allow?: string[], minLiteralLength?: number }
```

`minLiteralLength` defaults to 4.

## Isolation

```ts
{ siblings: string, except?: string[] }
```

`siblings` is a glob whose `*` groups name the islands.

## Members

```ts
// packages/lib/trueline.config.ts
export default defineMember({ zones, mayReach?, boundaries? })
```

A member config carries those three keys and nothing else. Runners, custom rules, `externals`, `protect`, `command` and the global limits stay at the root, because they are properties of the repository rather than of a package.

## Protection

```ts
protect: ["CLAUDE.md"]
protect: { paths: ["CLAUDE.md"], decision: "deny" }
```

The root config, every member config and the baseline are covered with no configuration at all. `decision` defaults to a permission prompt, and is downgraded to a refusal automatically wherever no person would see the prompt.

## Command line

| | |
|---|---|
| `npx trueline` | the full report |
| `npx trueline --dots` | one character per claim |
| `npx trueline --next` | one problem, then stop |
| `npx trueline --json` | machine-readable |
| `npx trueline --update-baseline` | record current violations |
| `npx trueline --config=<path>` | use a specific config |
| `npx trueline explain <path>` | what a file may reach |
| `npx trueline agent-instructions` | a block to append to `CLAUDE.md` |
| `npx trueline guard` | read a hook payload on stdin |

---
title: Configuration
description: Every key the config file accepts, and what each one does.
---

One file holds the rules for your project. This page lists every key that file accepts.

The file is TypeScript. It is found by walking upward through the directories, looking for trueup.config.ts, or the same name ending in .js or .mjs. Whichever directory holds it is the project root.

You do not have to write the first one yourself. This reads the shape of your tree and writes a config to match:

```sh
npx trueup init
```

Because the file is TypeScript, it can read the environment. That is useful for anything that should behave differently in CI.

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

Only the zones are required. Everything under them is optional, and a config with zones alone still runs nine claims.

## Root config

| key | type | default | effect |
|---|---|---|---|
| `zones` | `ZoneDefinition[]` | required unless `members` is used | The names every other rule is written in. |
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
| `protect` | `string[]` or `{ paths?, decision? }` | every rulebook and the baseline, always | [Extra paths an agent may not edit](/agents/guard/#the-rulebook-goes-through-you). |
| `maxFilesPerDirectory` | `number` | off | [Directory size limit](/checks/placement/#directory-size). |
| `duplication` | `number` | off | [Shortest declaration worth reporting](/checks/duplication/), in characters. |
| `colocation` | `boolean` | `false` | Turns on [the placement claims](/checks/placement/). |
| `readerships` | `boolean` | `false` | Turns on [the check for a file serving two audiences](/checks/placement/#one-file-answering-to-two-audiences). |
| `testInternals` | `boolean` | `false` | Turns on [the check for a test reaching an internal](/checks/placement/#tests-that-reach-an-internal). |
| `reviewable` | `ReviewBudget` | off | [How large a change may grow](/checks/#how-big-a-change-can-be-reviewed) before nobody can review it. |
| `command` | `string` | `trueup` | The command named in printed guidance. Set it to `pnpm lint:arch` and every message says that. |

## Zones

A zone is a name you give to a group of files, chosen by where the files sit.

```ts
{ name: string, patterns: string[], role?: "wiring" | "tests" | "api" }
```

A file belongs to the first zone whose patterns match it, in the order you declared them. [What each role changes](/concepts/zones/#roles).

## Boundaries

A boundary is a note saying which zones a zone is allowed to reach.

```ts
{ from: string, allow: string[], anchor?: "declaring-file" | "imported-module", ignoreTypeOnly?: boolean }
```

The allow list works as an allowlist, so anything you leave off it is refused. A zone always reaches itself, and a zone with no rule of its own is unrestricted. Write several rules for one zone and a reach has to satisfy all of them.

The anchor defaults to the declaring file, which is the file where a thing is actually written, after following every re-export. The rule attaches there rather than to the module you imported from. [The blunter alternative](/concepts/boundaries/#two-options-on-a-boundary).

## Seams

A seam is the line between reusable code and code that knows your business.

```ts
{ generic: string, domain: string[], allow?: string[], minLiteralLength?: number }
```

The minimum literal length defaults to four.

## Isolation

Isolation keeps a group of sibling directories from reaching into each other, without you naming any of them.

```ts
{ siblings: string, except?: string[], wiring?: string[] }
```

The siblings pattern is a glob, and each star in it names a group of directories to keep apart. The list of exceptions holds those names, meaning the directory names the star matched rather than whole paths. So this pair exempts src/routes/_shared:

```ts
{ siblings: "src/routes/*", except: ["_shared"] }
```

The wiring list names the files allowed to sit in the parent directory rather than inside one of the groups. Leave it out and that question is never asked. [What it reports](/checks/isolation/#files-that-sit-beside-the-group).

## Review budget

A review budget is the largest change you believe a person can actually read.

```ts
{ additions: number, deletions: number, severity?, nearing?, base?, except? }
```

The two required numbers are the most added lines and the most removed lines a single change may carry. Going over prints a warning unless severity is set to error. [What the other options do](/checks/#how-big-a-change-can-be-reviewed).

## Members

A member is one package inside a workspace that keeps its own rules.

```ts
// packages/lib/trueup.config.ts
import { defineMember } from "trueup";

export default defineMember({
  zones, allow?, boundaries?, seams?, isolate?, rules?, maxFilesPerDirectory?, doorsFromExports?
})
```

The doorsFromExports option builds the member's api zone from the exports field of its package.json, so you do not declare one yourself. [When that works and when it does not](/concepts/monorepos/#the-door-is-written-down-twice).

A rule written inside a member sees a project narrowed to that member: its own files, and its own zone names with no package prefix. Its findings are reported under the member name, then the rule name. [What that means for a rule spanning packages](/concepts/monorepos/#rules-that-belong-to-one-package).

Runners hand a job to another tool you already use, and they stay at the root. So do externals, protect, command and duplication. All of those are properties of the repository rather than of a package.

A member may declare its own isolation rules, and the patterns in them are read against the member's own directory.

## Protection

Protection names paths an agent may not edit, an agent being a coding assistant that writes code in your project.

```ts
protect: ["CLAUDE.md"]
protect: { paths: ["CLAUDE.md"], decision: "deny" }
```

The root config, every member config and the baseline are covered with no configuration at all. The baseline is the recorded list of problems you have agreed to live with for now.

The decision is ask, deny or allow. It defaults to a permission prompt, and is turned into a refusal automatically wherever no person would see that prompt.

The rulebook is the config file holding the rules, whether at the root or inside one package. Allow hands that rulebook to the agent in every mode, and every run then prints a notice line saying so. [What that gives up](/agents/guard/#handing-the-rulebook-over).

## Command line

| | |
|---|---|
| `npx trueup init` | write a starting config, and one per workspace package |
| `npx trueup` | the full report |
| `npx trueup --dots` | one character per claim |
| `npx trueup --next` | one problem, then stop |
| `npx trueup --next=<claim>` | one problem, from claims whose name contains that text |
| `npx trueup --json` | machine-readable |
| `npx trueup --gitlab` | [GitLab Code Quality](/start/reports/#on-a-gitlab-merge-request) |
| `npx trueup --update-baseline` | record current violations |
| `npx trueup --config=<path>` | use a specific config |
| `npx trueup --help` | this list, printed by the tool itself |
| `npx trueup explain <path>` | what a file may reach |
| `npx trueup explain <path>#<name>` | who reads one name, and what moving it would cost |
| `npx trueup explain --needs=<paths>` | [where a new file may live](/concepts/zones/#asking-where-a-new-file-may-live) |
| `npx trueup explain --read-by=<paths>` | narrows that answer to what may be reached from its readers |
| `npx trueup explain --ungoverned` | [zone pairs no boundary rule refuses](/concepts/boundaries/#traffic-no-rule-refuses) |
| `npx trueup activate` | [every zone, boundary and setting in force](/agents/instructions/#handing-an-agent-the-whole-shape) |
| `npx trueup agent-instructions` | a block to append to your agent's memory file |
| `npx trueup docs` | [every guide that ships with this version](/agents/instructions/#the-guides-travel-with-the-package) |
| `npx trueup docs <topic>` | one of those guides, printed in full |
| `npx trueup guard` | read a hook payload on stdin |

An argument that is not on this list is an error rather than something to ignore quietly.

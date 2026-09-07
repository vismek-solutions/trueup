# E — empirical run against gaime (measured, not guessed)

Artifacts: scratchpad/sa/

## MEASURED: performance is NOT the bottleneck
1,021 source files / 1,172 modules / 5,081 edges. Warm wall-clock:
biome 0.94s · oxlint 1.11s · depcruise 2.06s · madge 2.79s · knip 6.64s · ast-grep 0.03-0.19s/rule.
=> A Rust core bought for SPEED solves a problem that does not exist at this size.
Resolution correctness and rule expressiveness are the real bottlenecks.

## GAP A — the existing gate is FALSE GREEN (actionable bug in gaime today)
With gaime's own `.dependency-cruiser.cjs`, **385 of 5,081 edges never resolved**:
`@gaime/shared` x376, `@gaime/shared/vet` x7 — i.e. EVERY cross-package edge in the monorepo.
Each comes back `couldNotResolve: true, dependencyTypes: ["unknown"], valid: true`.
Root cause: `packages/shared/package.json` exports `.` -> `./src/index.ts`, and depcruise's
default enhanced-resolve has no `.ts` in `extensions`. The config carries no
`not-to-unresolvable` rule, so the reporter prints "no dependency violations found" and exits 0.
Fix: `options.enhancedResolveOptions.extensions` += .ts/.tsx. Also `apps/server/dist` (239 stale
build modules) is not excluded.
madge hits the same wall but SAYS SO ("Skipped 5 files"). depcruise stays silent.
=> RULING: unresolved edges must be a first-class failure, never a silent pass. Fail closed.

## GAP B — the barrel collapses the graph; no path rule can ever see a domain
`@gaime/shared` has one barrel `src/index.ts` imported by 329 files. After fixing resolution,
all 329 importers land on the SAME node. A rule
`from ^apps/web/src/components/ -> to ^packages/shared/src/(warrants|accusation|...)\.ts$`
fires 0 times, while the violation is visible in source:
`Prikaz.tsx:1` imports `Warrant, WarrantKind, FileWarrantRequest, FileWarrantResponse`.
Module resolution stops at the barrel and depcruise has no symbol layer.
=> NOT fixable with a better depcruise rule. **The tool must resolve to SYMBOLS, not modules.**
This is the single strongest technical argument for building something new.

## What DID express the constraint
Symbol-level import denial scoped by glob, in 3 tools, agreeing on the same 21 sites / 6 files:
- biome `style/noRestrictedImports` + `overrides.includes` -> 17
- oxlint `no-restricted-imports` + `overrides` -> 21
- ast-grep `import_specifier` + has/inside -> 21
Blocker for all three: a HAND-MAINTAINED denylist of symbol names. A new domain type is invisible
until a human edits the config. Imports only — never usage, never branching.

**Only ast-grep expressed BRANCHING** (the CLAUDE.md layering violation shape):
`binary_expression` with a `property_identifier` operand in a domain vocabulary -> 9 hits incl.
the real ones (`one.kind === "testimony"`, `kind === document.kind`).
Its blocker: NO TYPES. `cell.kind === "hlavni"` flagged identically where `cell` is a generic
table cell. ~2 of 9 noise.

## TRAPS measured
- **ast-grep: one `language:` per rule file.** `.tsx` and `.ts` need twin rules. First rule found
  9; its `typescript` twin found 12 more. A single-file author ships a rule silently missing 57%.
- **biome AND oxlint resolve globs against the CONFIG FILE's directory, not cwd.** A mis-scoped
  architecture rule reports a clean run, not an error ("Checked 0 files"). Prefix `**/` fixes it.
  Same silent-false-green class as Gap A.
- **biome `recommended: false` manufactures noise**: 7 `suppressions/unused` warnings because it
  flags `biome-ignore` comments for rules you disabled. Partial configs are not free.
- **oxlint `--type-aware` fails hard without tsgolint** ("Failed to find tsgolint executable");
  needs `npx -p oxlint -p oxlint-tsgolint oxlint`.

## Signal/noise, measured
- oxlint defaults: 15 findings, ~10 actionable — best ratio measured.
- oxlint pedantic + type-aware: ~7,300 findings in 1.8s; 52% is `prefer-readonly-parameter-types`.
  Unusable as a gate.
- knip: ~175 symbols, ~15 actionable. Verified FALSE POSITIVE: unused devDep `tailwindcss` — used
  via `@import "tailwindcss"` in index.css; knip does not read CSS at-imports. Counts highly
  sensitive to entry globs.
- biome + depcruise on the repo's own configs: 0 findings (healthy repo, not weak tools —
  modulo Gap A).

## Install friction (npx cache, measured)
depcruise 4.6MB/3.5s cold · madge 44.2MB/10.1s cold · knip 16.0MB/6.6s cold ·
oxlint 14.8MB/6.0s cold (36.6MB with tsgolint) · ast-grep 0 (system binary, 31ms runs).

## UNRESOLVED — gaime working tree went dirty during the run
3 modified files under `apps/web/src/routes/sluzebna/ucet/`, +261/-97, plus
`.gate.local.json`/`.size.local.json`/`.e2e.local.json` rewritten at 14:14:48-14:15:09.
Agent's evidence it was not the cause: diff is feature work (new `AccountActs` facade type, 211
added test lines); no `--write`/`--fix` flag was ever passed; `accountQueries.ts` mtime 14:19:45,
13s before the final git status and minutes after the last repo-touching command; the gate files
are written by the repo's own `scripts/gate.mjs` which was never invoked.
=> Looks like a concurrent session, not this run. MUST be confirmed with the user, not assumed.

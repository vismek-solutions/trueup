# F — fallow, hands-on against gaime (measured, decisive)

Run: `npx fallow@latest --root gaime` -> **exit 0, 3s wall (1010ms analysis), 1094 files,
13,585 functions.** 100 issues: 74 unused-exports, 10 unused-files, 7 unresolved-imports,
6 unused-types, 2 duplicate-exports, 1 unlisted-dep. Zero cycles. Dupes 96 families / 362
instances / 4.72%. Health: 236 functions over threshold, avg maintainability 90.1, 63 critical.

## Where fallow BEATS the current setup
- **It resolves `@gaime/shared` correctly** — reads `exports: {".": "./src/index.ts"}` natively.
  dependency-cruiser lost every one of those edges silently.
- **Unresolved imports default to severity `error` and count toward the total.** It does not pass
  silently. Its 7 unresolved are genuine (`/styles.css` absolute hrefs in HTML).
- **74 unused-exports are real, novel signal** — "exported but used only locally", which biome and
  dependency-cruiser structurally cannot see. 4 sampled, all verified true positives.
- Unused-FILES (10) are mostly noise: script entry points needing config. One self-contradiction:
  reports `apps/landing/public/styles.css` unused while also reporting 7 unresolved `/styles.css`
  imports from the HTML that references it.

## THE CEILING — measured, not inferred
`BoundaryRule` has exactly three fields: `from` / `allow` / `allowTypeOnly`. All zone-name-based.
The rule-pack loader fails loud and enumerates its complete field set:
`id, kind, callees, specifiers, effects, exports, ignoreTypeOnly, files, exclude, zones, message,
severity` — **no symbol/name field exists.** `banned-import` matches the RAW SPECIFIER only.
Rule `kind` is a closed set of FOUR, per the loader's own error:
`banned-call, banned-import, banned-effect, banned-export`.
Rule packs are "pure data: loading a pack never executes project code" => **no user-authored rule
can execute.** No plugin API. Extension points are MCP/LSP/agent-skills only.

### (a) Symbol-level boundary through a barrel — NO, with a measured precision cost
Zones `components`+`shared`, rule `{from: components, allow: []}` -> **exactly 8 violations, every
single `to_path` = `packages/shared/src/index.ts`.** 4 are the wanted ones (`prikaz/*`); 4 are
legitimate imports of `faceOf`, `CasePreview`, `emailSchema`, `ClueDocument`.
**50% precision. `--type-aware` does not change it — still 8.**

### (b) Generic code must not name a domain concept — NO, structurally
No rule kind keys on a string literal, a discriminant, a `switch`, or a destructuring shape.
Loader error proves the closed set: `unknown variant 'banned-literal-comparison', expected one of
banned-call, banned-import, banned-effect, banned-export`.
Across all 117 issue types there is no such check. The only literal-branch detector is
`feature-flag` (off by default, flag-scoped). `type-coupling` and `decision-surface` are advisory
degree-metrics over the same import graph.

## THE OPENING — the capability exists but is a QUERY, not a GATE
`--type-aware-project` for both tsconfigs, then
`--symbol-impact packages/shared/src/warrants.ts:Warrant`
returned **precisely the 3 real consumers** (`Prikaz.tsx`, `prikazView.ts`, `runView.ts`), matching
`rg` exactly — through `export * from "./warrants.js"`, ACROSS the package boundary, for a
TYPE-ONLY import. The symbol identity a symbol-level rule would need is already computed.
It simply cannot be attached to a rule.

**THE GAP, one sentence:** fallow's enforcement resolution is the module edge and its rule language
is a closed four-kind data format, so no user-authored rule can gate on which symbols cross a
boundary or on a generic component naming a domain concept — even though its own type-aware
sidecar already computes the symbol identity such a rule would need.
The clause a competitor cannot also claim: **the capability is present but unexposed.**

## BUG FOUND — fallow's own false green (report upstream)
gaime has no root composite tsconfig (only `tsconfig.base.json`). With default project
auto-selection, `fallow dead-code --type-aware --symbol-impact packages/shared/src/warrants.ts:Warrant`
picks `packages/shared/tsconfig.json`, which cannot see `apps/web`, and returns
`assertion: no-consumers-found, status: complete, confidence: high, completeness: complete`
— **while three consumers exist.** `--type-aware-require complete` does NOT catch it (exit 0).
The tool HAS the vocabulary (it correctly emits `completeness: unavailable` in other scopings); it
just doesn't use it here. This is the exact command its `--help` advertises as "prove exact
TypeScript symbol consumers", and the docs promise every semantic result reports
complete/partial/unavailable.
Damage scope: the DELETION path is safe (0 `packages/shared` exports flagged unused; the syntactic
layer resolves barrels correctly). Only the advertised EVIDENCE QUERY misreports.
**An agent trusting it before deleting would delete live code.**

## Licensing / lock-in — clean
MIT, 18 Rust crates public incl. `crates/license` (enforcement path auditable). npm ships
Ed25519-signed prebuilt binaries from that source. **All static analysis is free**; only
`--runtime-coverage` (Fallow Runtime) is paid, with a single free local capture. No published
price anywhere in docs. Expired licences degrade with a watermark before failing closed; static
analysis untouched. Offline-capable, offline licence verification, air-gap documented.
Only closed component is `@fallow-cli/fallow-cov` from a private repo.
Telemetry opt-in, off by default, `DO_NOT_TRACK` top precedence. CAVEAT: an on-by-default
background version check on interactive TTY runs (`FALLOW_UPDATE_CHECK=off`), and an undocumented
`_meta.telemetry.analysis_run_id` appears in local JSON even with `DO_NOT_TRACK=1`.

## Adoption frictions
- Rule-pack files MUST live inside the project root (an external path is rejected outright).
- Zero-config defaults nearly every issue type to `error`.
- `--workspace` scopes OUTPUT only, never analysis.
- Hidden directories are never traversed => `.claude/**` is invisible.
- **78 of 117 issue types do not count toward the exit gate** — "0 issues" means less than it reads.
- Default cache is `.fallow/cache.bin` in the repo; redirect with `FALLOW_CACHE_DIR`.

# C — landscape survey (verified Sept 2026). Durable rulings only.

## THE SEVEN GAPS (the product thesis lives here)
1. **Nothing binds file placement/naming to the import graph.** dependency-cruiser has the graph and
   ZERO naming/folder rules; ls-lint (`exists:N`) and eslint-plugin-project-structure (conditional
   required existence) have folder rules and no graph; check-file has names only.
   "A file under `features/*/api/` must be named `*.api.ts`, must be the only module importing the
   http client, and must export exactly one function" — not expressible in ANY single tool.
2. **Export-surface PINNING does not exist.** Sheriff/boundaries/Biome `noPrivateImports`/
   import-access all encode visibility as convention or JSDoc tags. None can assert "module X's
   public API is exactly this symbol set" and diff it across commits. knip finds UNUSED exports;
   nothing finds OVER-EXPOSED ones.
3. **Ownership is disconnected.** No OSS tool joins CODEOWNERS to the module graph.
4. **Custom rules with a whole-project graph are PAID or ABSENT.** Biome plugins = single-file
   GritQL, no graph, no types, and no JS plugin API on the 2026 roadmap. oxlint JS plugins = alpha,
   no type info, graph access undocumented. ast-grep = explicitly single-file (no scope, type, CFG,
   dataflow). semgrep CE = single-FUNCTION. Only `@nx/conformance` gives a TS rule first-class graph
   access — and its npm licence field literally reads `"Commercial"` (Nx core stays MIT).
   ==> THIS IS THE BIGGEST GAP AND IT ARGUES FOR A TS CORE.
5. **No cross-tool ratchet.** dependency-cruiser is the ONLY tool here with a real baseline
   (`--baseline` + `--ignore-known`). ESLint plugins, knip, ast-grep, steiger have none. Nothing
   says "these 340 violations are known debt, fail only on new ones" ACROSS classes.
6. **Architecture x code shape is unreachable.** "Any class named `*Repository` lives in `infra/`
   and implements a port from `domain/`" needs naming + placement + graph + types at once.
   ArchUnitTS is closest (naming + layers + metrics) but has no implements/type checks.
7. **Nothing detects PARALLEL IMPLEMENTATIONS** — two modules independently doing the same job.
   fallow's duplication/semantic-similarity is the only near-miss; it measures similarity, not
   architectural equivalence. (This is arguably THE agent-generated-code failure mode.)

## fallow — verdict from docs (hands-on pending)
Best OSS composite and the best answer to "one command". BUT per its own docs
(docs.fallow.tools/analysis/boundaries.md): boundaries = **glob zones + ALLOW-LISTS ONLY**,
first-match-wins. Cannot express forbid-rules, entry-point/public-API restrictions, cardinality,
or per-file exceptions. **No user-authored rule language at all** — extension points are MCP/LSP/
agent skills only. 219 releases in 6 months => real API churn risk.
`npx fallow agent install` wires Claude Code/Codex/Cursor: AGENTS.md task map, version-matched
skill under node_modules/fallow/skills/fallow, MCP registration, commit/push gates.
Exit codes 0 clean / 1 findings / 2 error. The checks themselves are NOT AI-specific — it is a
good analyzer with an excellent agent front-door.
Benchmarks vs knip: wins fastify (64ms vs 205ms), preact (74ms vs 2.01s); LOSES astro and TypeScript.

## Delegate, do not reimplement
- Import graph + resolution -> dependency-cruiser JSON, or oxc-resolver for speed.
  TS `paths` + `exports` conditions + barrels is the single worst thing to rebuild.
- Dead code / unused deps -> knip. ts-prune, unimported, depcheck are ALL ARCHIVED; one live answer.
- Cycles -> solved five times over (dep-cruiser, oxlint, Biome, madge, fallow).
- Naming/layout -> eslint-plugin-check-file + eslint-plugin-project-structure, or ls-lint.
- Package hygiene -> publint + are-the-types-wrong + syncpack (three narrow, stable, non-overlapping;
  knip overlaps NONE of them).
- Single-file shape -> ast-grep (`@ast-grep/napi` exposes `SgRoot.filename()` under `findInFiles`,
  so you can layer graph logic on top yourself).
- Duplication -> jscpd (4.14M/wk) or fallow.
- PR surface/ownership plumbing -> danger-js (sees the diff, NOT the module graph).
- Pick ONE of boundaries / Sheriff / Nx — same constraint class, three config models.
- import-x over import; ArchUnitTS over ts-arch (ts-arch stopped Dec 2024); core ESLint
  no-restricted-imports over the deprecated typescript-eslint one.

## Tool-specific traps
- **oxlint `import/no-restricted-paths` is NOT IMPLEMENTED** (oxc#13789, open since 2025-09-15, no
  maintainer response). oxlint has multi-file analysis in core but not this rule.
- **Biome has NO layer-direction rule at all.** `noUndeclaredDependencies` is explicitly not
  monorepo-aware. tsconfig `paths` support is partial/buggy (biome#6474, #7644).
- **semgrep CE has no metavariable for the scanned file's path** — only per-rule `paths:` globs,
  and `include` can only narrow (#11144). Cycles not expressible. Interfile analysis, `join:` mode
  and interprocedural taint are Pro-only. Semgrep-authored RULES moved (Dec 2024) to a licence
  limited to "internal business use" => Opengrep LGPL fork exists.
- **Sheriff walks from ENTRY FILES** — unreached files invisible.
- **eslint-plugin-import-access** is the ONLY tool doing per-SYMBOL visibility (type-checker driven,
  JSDoc @package/@private on individual exports). Worth studying.
- good-fences JS is dead by its own README; its idea (per-directory `fence.json` colocated with
  code) survives in boundaries/Sheriff. Colocated contracts are a proven ergonomic.
- Structure101 is GONE (structure101.com redirects to Sonar, "no longer available for sale").

## Competitors in the exact niche
- `@nx/conformance` 5.0.9 — mature, Nx-only, npm licence `"Commercial"`. Only tool with graph
  access from a TS rule.
- SonarQube Server 2026.4 — architecture analysis moved from Cloud into Server at no extra cost;
  declare intended architecture, deviations become quality-gate issues. Proprietary. Strongest
  non-OSS option. Also ships a "Sonar way for Agentic AI" gate.
- `@archlinter/cli` 0.17.1 (2026-08-10, MIT, 42*, **1,011/wk**) — Rust+oxc, 28+ detectors, framework
  presets, **ratchet/diff mode**, ESLint plugin AND MCP server. Closest purpose-built composite.
  Early, near-zero adoption. CHECK THIS ONE.
- steiger 0.6.0 — composite but Feature-Sliced-Design only and "not extendable with more rules".
- checkride 0.12.5 — coherent thesis (one command as definition of done), 1 star.

## Agent-drift tools — skeptical verdicts
REAL: fallow (front-door, not AI-specific checks) · CodeRabbit (runs ast-grep 0.45.2 with YOUR
YAML rules per-PR — genuinely enforces boundaries; commercial) · SonarQube 2026.4 ·
agnix 0.52.2 (405*, 8.8k/wk, 455 rules, LSP — but it lints AGENT CONFIG FILES, not code
architecture).
NOVEL BUT PRE-ADOPTION — **write-time enforcement, the unoccupied position**:
- `@cuzfrog/module-gates` 1.1.4 (MIT, **115/wk**) — intercepts an agent's write/edit and blocks it
  against per-directory `MODULE.md` contracts (`readonly`, `no-new-exports`, index-only imports).
  Bridges for Claude Code, pi, Devin CLI.
- ASTrograph (~8*, MIT) — MCP server that blocks an agent write when a structurally identical
  function already exists (Weisfeiler-Leman AST hashing). Most on-target concept for agent-created
  duplication; near-toy.
- `@erode-app/cli` 0.10.2 (167/wk) — architecture drift on PR/local diffs vs a declared model.
VAPOURWARE, flagged: `thuban` (markets as "code integrity engine", is actually an OS-level sandbox
for agent syscalls; **GitHub repo 404s**) · `@lambdacurry/anvil` (audits rule FILES, not code) ·
slop detectors (regex heuristics for TODOs/hedging/empty functions).
**Bottom line: nothing mature enforces architecture at the moment of writing. Everything mature is
review-time (CodeRabbit, Sonar) or gate-time (fallow).**

## Unverified, flagged by the agent
Nx `notDependOnLibsWithTags`/`bannedExternalImports`/`banTransitiveDependencies` (options page 404s);
glob library behind ESLint no-restricted-imports `group`; syncpack Rust rewrite completeness;
whether oxlint JS plugins or Biome GritQL plugins can reach the module graph (undocumented, not
explicitly forbidden); Biome 2.5 head-to-head benchmark figures (third-party blogs).

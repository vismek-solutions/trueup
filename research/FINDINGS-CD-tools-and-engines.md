# C + D — landscape and engine layer (verified Sept 2026)

## THE COMPETITOR — `fallow` (verified by me, npm API, not agent-reported)
npm `fallow` 3.23.0, MIT, **945,189 downloads last week** (2026-08-31..09-06), first published
2026-03-17, github.com/fallow-rs/fallow, docs.fallow.tools (has an llms.txt).
Rust core on oxc. 8 platform triples via optionalDependencies + `fallow-type-aware` sidecar
("TypeScript-Go semantic refinement sidecar"). Node >=22. Bins: `fallow`, `fallow-lsp`,
`fallow-mcp`. Package exports `./skills/*`, `capabilities.json`, `issue-registry.json`.
Self-description: "Codebase intelligence for TS/JS. Free static analysis of code and styles,
optional paid runtime intelligence (Fallow Runtime). Quality, risk, ARCHITECTURE, dependencies,
duplication, and design-system drift for humans, CI, and the agents."
Docs list: dead code, duplication, complexity/health, ARCHITECTURE DRIFT, design-system styling,
feature-flag branches, runtime coverage (paid layer). "No config needed for the first run."
=> This is the user's stated design, already shipped, with a commercial tier.
Reported boundary model is glob zones with ALLOWLISTS (no forbid rules, no entry-point
restrictions) — UNVERIFIED, being checked hands-on.

## RULING — the strongest structural fact found
**Every rule DSL in this space is SINGLE-FILE.** GritQL, ast-grep YAML, Biome plugins, oxlint JS
plugins — none can express "layer A must not reach layer B". Cross-file architecture rules have
no user-authorable language anywhere. The pattern that demonstrably travels is ArchUnit's
fluent HOST-LANGUAGE API (Konsist, PHPat, ArchUnitTS).
=> A Rust core forces you to embed a JS runtime or invent a DSL. A TS core makes
rules-as-TS-functions free. This is the single best argument against Rust.

## Performance is not the complaint (two independent confirmations)
- Measured by agent E on gaime: every tool 1-7s on 1021 files.
- Loudest dependency-cruiser perf report (issue #590, BrexHQ) is ~2 min on a large all-TS
  frontend, and it has a cache. User complaints cluster on CONFIG DIFFICULTY, FALSE POSITIVES,
  and SILENT RESOLUTION FAILURES.
- Prisma 7.0.0 (2025-11-19) went the REVERSE direction: replaced its Rust engine with TS+WASM,
  reporting 14MB -> 1.6MB and faster queries.

## Correctness bugs in incumbents = the actual moat (language-agnostic)
- **dependency-cruiser 18.2.0 defaults `tsPreCompilationDeps: false`** => `import type { X } from
  '@app/internal'` is INVISIBLE to boundary rules by default. Dynamic imports resolve only with
  static string args. Supports `.dependency-cruiser.ts` as of 18.2.0.
- **eslint-plugin-boundaries 7.2.0**: under strict pnpm workspaces an unresolvable specifier is
  SKIPPED, not flagged — silent false negative. Same class as gaime's false-green.
- **madge 8.0.0** published 2024-08-05, unmaintained ~2 years despite 2.64M dl/wk; documented
  type-only-import cycle bug (#232).
- **Sheriff walks the graph FROM ENTRY FILES** => unreached files are invisible to it.
- **ESLint core `no-restricted-imports` has NO resolver at all** — matches the specifier string as
  written, so relative-path restrictions are depth-dependent and unreliable.
  (`@typescript-eslint/no-restricted-imports` is deprecated; core rule handles type imports as of
  ESLint 9.37.0.)

## Landscape deltas worth knowing
- **eslint-plugin-boundaries v7** (2026-07-05) restructured: one canonical rule
  `boundaries/dependencies` with `{default: allow|disallow, policies:[{from, allow, disallow}]}`,
  selectors over element/file/module incl. `module.origin: "external"`. Old rules are deprecated
  aliases. Exposes `DependencyKind = value|type|typeof` => type-only edges ARE distinguishable.
  Docs at jsboundaries.dev; also published as `@boundaries/eslint-plugin`.
- **Sheriff has an active fork**: `@lambda-solutions/sheriff-core` 1.1.0 (2026-08-10) adds
  denyRules, externalRules, file-level exports, multi-config, plus MCP and LSP servers. Upstream
  has a 12-month release gap.
- **Filesystem structure IS partly solvable**: `@ls-lint/ls-lint` has `exists:N` / `exists:N-M`
  (combinable: `.ts: kebab-case | exists:1`); `eslint-plugin-project-structure/folder-structure`
  supports conditional required existence. `eslint-plugin-check-file` CANNOT — ESLint only visits
  files that exist. But neither sees the import graph, and dependency-cruiser has no naming or
  folder-content rules. That split is a real gap.
- knip: 182 plugins, `--cache` (10-40% faster), `@knip/language-server`, `@knip/mcp`.
  Subsumes depcheck (archived 2025-06-16) and ts-prune. Does NOT overlap publint/attw/syncpack.
- ArchUnitTS: caching, metrics (lcom96b, distance from main sequence), custom rules via
  `adhereTo(fn)`, DOT/Mermaid/D2 export.
- `eslint-import-resolver-typescript` 4.4.5 rewritten on rspack-resolver (wraps oxc-resolver).
- good-fences JS is unmaintained by its own README (points to good-fences-rs). Do not adopt.

## Engine layer — verified versions
| Layer | Top | Decisive fact |
|---|---|---|
| Parser + single-file semantics | `oxc_parser`/`oxc_semantic` 0.148.0, MIT | real scope tree + symbol table + references. swc gives only hygiene marks. Parses typescript.js in 26.3ms vs swc 84.1 / Biome 130.1 |
| Cross-file resolution | `oxc_resolver` 11.24.3, MIT | tsconfig paths/baseUrl/extends/project references/${configDir}, exports+imports conditions, browser field, pnpm symlinks, built-in DTS resolver. **Only oxc crate with a semver track record (11.x).** Also shipped as an npm napi package — usable from Node today. |
| Type oracle | out-of-process tsgo sidecar | no supported API; see risk |
| Distribution | napi-rs 3.12.2 + per-platform optionalDependencies | one artifact serves CLI and JS API |

**Cannot reuse**: `oxc_linter` is NOT on crates.io (`publish = false`) — oxlint's rule engine is
unavailable. Biome's crates are frozen at 0.5.7 since 2024-03-12 while the CLI is 2.5.12;
maintainers (biome#7904): "we can't spend more maintenance energies on the crates." Treat as
internal. `ast_grep_core` docs say verbatim "Rust API is not stable yet" (44 breaking changes
across 181 releases). `tree-sitter-typescript` is 0.23.2 from 2024-11-11 — 22 months stale against
a 0.27.0 core, weaker locals.scm (no @local.scope/@local.reference).

## TYPE INFORMATION — the biggest technical risk
`typescript@7.0.2` is now `latest` (GA 2026-07-08). Microsoft's own GA post: *"While TypeScript 7.0
is here, it does not ship with an API. We expect TypeScript 7.1 to ship with a new (and different)
API."* Root export is literally `./lib/version.cjs`; everything real is behind
`./unstable/{sync,async,fs,proto,ast}`. `@typescript/typescript6` is a compat re-export.
`microsoft/typescript-go` was ARCHIVED 2026-09-01, folded into microsoft/TypeScript; a
`tsgo --api` IPC server exists in source but is undocumented. Speedups ~10-12x (magnitude
reliable, digits disputed).
Both credible precedents use a separate Go SIDECAR: oxlint ships `oxlint-tsgolint@7`
(59/61 typescript-eslint type-aware rules, stable 2026-07-22); fallow ships `fallow-type-aware`.
=> Any type-dependent rule means maintaining a version-matched sidecar against a moving target.

**Where types are NOT needed**: barrels / `export *` re-export chains need per-symbol tracking,
not types — `oxc_semantic` + your own export graph suffices. Genuine type dependence is narrow:
DI tokens, string-keyed module registries, conditional-type indirection.

## Rejected engine options
- SCIP: `@sourcegraph/scip-typescript` is 0.4.0, last published 2025-10-02, and it RUNS TSC ANYWAY
  — you inherit tsc's cost plus index staleness. (The Rust `scip` crate itself is healthy, 0.10.0.)
- `stack-graphs` 0.14.1, 2024-12-13 — 21 months stale.

## Distribution facts
oxlint 1.81.0: napi addon + 46-byte JS shim, 19 triples, 11.7MB/platform.
@biomejs/biome 2.5.12: raw binary, 8 triples, 53.4MB. esbuild 0.28.2: 26 triples, 10.1MB.
typescript 7.0.2: raw binary, 20 triples, 26.2MB. fallow 3.23.0: 8 triples, 40.0MB.
**None use postinstall downloads.** The npm optional-deps lockfile bug (npm/cli#4828) was fixed in
npm 11.3.0 (~2025-04-03). `@napi-rs/cli` 3.9.0 bundles cargo-zigbuild + cargo-xwin.
Realistic minimum: 8 triples.

## Licensing
MIT: oxc, oxc_resolver, ast-grep, tree-sitter, GritQL (donated to Biome org 2025-12-18), fallow.
Apache-2.0: swc, scip crate. **CodeQL: barred from non-OSS/commercial use without GHAS.**
**Semgrep: semgrep-core is LGPL-2.1 and interfile analysis is Pro-only.**
**`@nx/conformance` is `"license": "Commercial"`** (Nx core itself remains MIT).

## Distribution reality — incumbents are entrenched
dependency-cruiser 3.40M/wk · madge 2.64M/wk · eslint-plugin-boundaries 1.48M/wk ·
fallow 945k/wk · sheriff 77k/wk · ArchUnitTS 24k/wk.
Distribution, not engine, decides this.

# A — gaime forensics (distilled, durable)

## Shape of the attempt
Off-the-shelf carries almost nothing. dependency-cruiser is kept ONLY as an import resolver
(18 generated rules, cross-package direction + cycles). Everything with real ambition is
homegrown Node scripts. Biome does style only. Single entrypoint `pnpm check` / `check:ci`.
No git hooks — "must pass before commit" is prose in CLAUDE.md plus CI.

## The keystone idea: ONE topology model
`scripts/layout.cjs` is the single source of truth for topology (kernel dirs, file KINDS via
regex, a FORBIDDEN kind-x-kind table, slices/roots/barrels derived from the filesystem).
The depcruise config is GENERATED from it, and every script reads it.
Motivation, in the repo's own commit: four tools held four notions of a composition root and no
two agreed; the slice roster was written three times over, once by hand in a cruiser alternation
edited on every slice added.

## Constraint classes actually expressed
1. Cross-package direction + no cycles (depcruise).
2. Layer/kind direction inside one app, table-driven (kind x kind FORBIDDEN matrix).
3. Placement/privacy: provider-private files, no cross-slice imports, per-symbol export reach.
4. Mount-order constraint parsed out of App.tsx + route JSX (a provider may only read providers
   that wrap it).
5. CSS ownership: one class defined in exactly one stylesheet, namespace must match directory,
   component filename must match a stem the family's CSS defines.
6. Export surface: every export imported somewhere; one component per .tsx.
7. VOCABULARY rules — pure text, no import edge: no component/desk/styles/browser/state file may
   name `isPending|mutateAsync|refetch|UseMutationResult|.mutate(` etc.
8. Bundle budget; an UNBUDGETED asset group fails (fail-closed).

## RULINGS to carry into the new tool
- **Import graphs cannot see props.** A mutation handed to a chrome component as a prop crosses
  no import edge. The type that permitted it was declared in the component itself, mirroring a
  shape it was never allowed to name. This is why vocabulary/text claims exist at all.
  => An import-graph-only architecture linter is structurally insufficient. Confirmed empirically.
- **Chained `&&` gates hide regressions.** A run clearing 18 errors could not say whether the
  standing list had moved, because the list was never reached. => run every claim every pass,
  one report, one exit code.
- **Skip-lists rot invisibly.** "An exemption is invisible to the gate it switches off."
  Four exemption lists had rotted. No exemption list survives today. => suppressions must be
  visible in the report, or not exist.
- **depcruise asked for JSON EXITS 0 EVEN WHEN IT FINDS SOMETHING.** Count from summary, never
  from status. (trap when wrapping it)
- **Incremental gate keyed on per-scope SHA-256** exists because agent + session run the same
  gate on the same files and both pay in full.
- **"THE COUNT IS NOT THE MEASURE"** — the soft/heuristic report penalises over-decomposition and
  a good change can raise the count. Soft findings were never made failing.

## The admitted GAP — the actual target of the new tool
The real rule is prose only, in docs/boundaries.md: "A violation is a SEAM problem, not an address
problem. Whoever owns a thing answers questions about it. One call per collaborator per operation."
No check tests it. Adjudication is delegated to a human/agent reading an 11 kB answer guide.
7 "soft" heuristics in reach.mjs are admitted proxies and never fail the build.

## Blind spots to beat
- Regex TS reader (`source.cjs`): only a named brace import from a relative specifier can cross a
  boundary. Blind to default/namespace imports, `export … from`, and cross-package `@scope/*`.
- "usedAtHome" counts any mention — a name in a comment counts as a use.
- Destructuring/field parsing defeated by a spread, a rename, or a reformat.
- Coverage is `apps/web/src` only; the server app (30+ domain dirs) has ONE rule.
- Documented false-positive classes, each cost a fix: types reported as spec-only; a hook's own
  error message counted as self-use; a barrel counted as a consumer; moves the layer table forbids
  reported as movable; types carved via Extract/Pick/Omit/keyof treated as splittable.
- Doc drift: CLAUDE.md says twelve claims, the script asserts fourteen.

## Paths to open when designing
- gaime/scripts/layout.cjs — topology model, the design keystone
- gaime/scripts/vertical.mjs — the 14 claims + report format
- gaime/docs/boundaries.md — what the tooling cannot decide, and every wrong answer already given
- gaime/scripts/reach.mjs — the 7 seam heuristics and their regex ceiling
- gaime/scripts/gate.mjs + tree.mjs — fail-open-is-forbidden incremental gate

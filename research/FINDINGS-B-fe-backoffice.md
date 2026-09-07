# B — fe-backoffice forensics (distilled, durable)

## CONVERGENCE with gaime — independently, both repos landed on the same shape
1. A tiny homegrown **layer/topology table** is the single source of truth
   (`app/tools/layers/layers.cjs`, 36 lines / gaime `scripts/layout.cjs`).
2. The **dependency-cruiser config is GENERATED from that table** (15 tier-pair rules here).
3. A homegrown gate makes **"the claims the cruiser cannot make"** — its own header words.
4. The **actual target constraint is prose only**, adjudicated by a human/LLM.
   Here it is the dev skill's phase-5 checklist item, verbatim:
   *"generic code not naming domain concepts"* — the exact thing `no-generic-into-domain`
   can only approximate as "doesn't import ~/api".
This is the gap, confirmed twice from two independent codebases.

## What the homegrown gate adds beyond an import-graph tool (reusable list)
- **Completeness claims, fail-closed**: every file under src/ matches exactly one tier; every
  declared tier has >=1 file; the ORDER list names only real tiers. A new unclassified top-level
  directory fails the build, and an empty cruise fails rather than passing vacuously.
- **Line numbers**: "dependency-cruiser records no position, but it does keep the specifier as the
  source wrote it" — the gate re-reads the source to locate the import line.
- **Baseline diffing with a STALE-entry signal** (fixed violations still listed).
- **Unforbidden-pair report** — "a boundary nobody meant to open": tier pairs with near-zero
  traffic that are allowed but arguably shouldn't be. Never acted on, but the idea is good.

## Generation-two moves (this is the newer of the two attempts; 5 commits, 2026-09-05..09-07)
- Baseline + warn instead of fail-everything: 272 known violations, new ones fail, known ones warn.
- Stale-entry = exit code 2, rendered ORANGE not red. Stated reason: *"There are hundreds; a job
  permanently orange is a job nobody looks at. The warning fires only on something actionable."*
- Per-line MR annotations via GitLab Code Quality report, not job-log output.
- Target admitted as aspirational: "This is the target, not the current state" — converge on touch,
  no sweeping refactor.

## Constraint classes here (beyond gaime's)
- Ordered tier list `root > feature > domain > platform > api > kernel`; import right, never left.
- Cross-feature isolation: `features/X` must not import `features/Y`; shared code moves up.
- Kind x location rule: `*.component.ts` must not import `~/api/**`.
- Generic-subtree rule: `shared/{components,pipes,directives,validators,decorators}` must not
  import `~/api/**`. Needed because those dirs ARE `platform`, and platform->api is legal for the
  many services that legitimately fetch. => path-tier alone is too coarse; a second axis is needed.
- No prod -> test import (specs may import anything).
- Cycles, value-carrying only.

## TRAPS / rulings
- **dependency-cruiser has no first-match-wins.** A selector must spell out what earlier tiers
  already took (domain and kernel are subtrees of shared/, so platform must match last).
  => MATCH_ORDER != ORDER. A new tool should have explicit first-match-wins classification.
- **Type-only cycles are false positives** when the codebase writes types with plain
  `import { … }` instead of `import type`. dependency-cruiser cannot tell the edges apart.
  They got baselined alongside real ones. => needs real type/AST awareness, not resolution alone.
- **A non-blocking check gets ignored.** Repo's words on the a11y probe, deliberately not in CI:
  *"a non-blocking artifact gets ignored … until then it's decoration."*
- **Regex over AST was a deliberate ruling, and it failed.** App-map generator: *"intentionally
  dumb (regex + directory listing, no TypeScript AST) … fix the regex rather than reaching for a
  full parser."* Its own roadmap then admits it misses child-of-child routes, library-wrapped
  routes, and computed path constants. Same failure class as gaime's `source.cjs`.
- **The "one check command" is not green at baseline** — `.dev/87073/notes.md` records npm test red
  on master with 32 pre-existing lint errors and a bundle-budget failure.
- **Three agent surfaces drifted**: `.claude/`, `.cursor/`, `.agents/` disagree; AGENTS.md cites a
  `.cursor/rules/index.mdc` that does not exist. Doc rot inside the enforcement layer itself.

## Prose constraints with NO mechanism (the demand list for the new tool)
API models stay behind the service layer, mapped once at that boundary; `*Model` reserved for the
wire type; no `as`, no `!`; `inject()` not constructor DI; signals API; default export only for
lazy route components; Luxon never `Date`; `readonly` on injected services/subjects/outputs but not
on `input()`; suffix<->file-kind pairing (`*Service`, `*Provider`, `*.routes.ts`); guard clauses
over wrapped bodies; new strings need i18n keys; docs updated in the same change.
Most of these are *shape* rules over a single file — ast-grep-class, not import-graph-class.

## Lead worth following later
A third sibling repo `bh/node-api` reportedly carries AGENT-TIME enforcement that
fe-backoffice lacks: `.claude/hooks/`, committed `.claude/settings.json`, `scripts/ai-hooks/`,
`ARCHITECTURE.md`, `docs/principles/`. fe-backoffice has zero agent-time enforcement — its gate
runs only at `npm test`/CI. NOT verified; the agent only listed directories.

# Changelog

## Unreleased

The first stable release. The command line, the rulebook keys, the claim names and the exit codes stay as they are until the first number moves again.

### Fixed

- The explain command called with no path exits 4, an argument it does not know. It exited 3, which means no rulebook found.
- The json flag leaves out the guidance of a claim that found nothing. It carried every claim's guidance, which on a clean run was most of the output.
- A next filter naming no claim exits 4 on an otherwise clean run. It exited 0, so a typo passed as a clean check. A run with errors or a stale baseline keeps its own code.
- The boundary claim and the seam claim run only when `boundaries` or `seams` is set, as the guides already said. Both ran on every project and reported a pass on rules nobody had written.
- Two flags asking for different reports are refused with exit 4. One of them won quietly and the other was dropped.
- Accepting a baseline reports the entries it dropped as well as the ones it took. A run that only dropped entries said nothing new.
- A claim name given to the docs command prints the page that explains that claim. It printed a list of every page mentioning the name and asked for one of them. Each guide names the claims it explains under `claims` in its frontmatter.

### Added

- The next flag takes the config key that turns a claim on, so `--next=seams`, `--next=duplication` and `--next=colocation` each reach their claim. A fragment of a claim name still works as before.
- The npm page links back to the source, through a repository field in the manifest.

### Changed

- The list shown when a next filter names no claim gives each claim the config key that turns it on.
- The remedy printed with a boundary finding names the api zone that closed the target, when the import crossed from one package to another. It described the refusal without naming the door.

## 0.1.0

The first published release.

### Added

- Zones, which name a group of files by where the files sit, and boundaries, which say what each zone may reach.
- A graph built from resolved symbols rather than from import text, so a chain of re-exports leads to the file where a name is actually written.
- Seam rules, which stop reusable code naming a domain concept it never imported. The vocabulary comes from the domain zone itself and is worked out on every run.
- Isolation rules, which keep sibling directories out of each other.
- Placement checks: a value declared away from its only reader, a file serving two readerships, a test reaching an internal, an export that exists only for a test, and a directory holding too many files.
- Duplication at declaration granularity, which reports the same body written twice and names where a shared copy could live.
- Rules you write yourself, reading a small facade over the project rather than the syntax tree.
- Monorepo members, where each package declares what it reaches and the root declares what nobody may.
- Delegated tools, so findings from biome, oxlint and fallow arrive in the same report under the same exit code.
- A baseline, which accepts the findings standing now so that only new ones fail.
- The guard command, which rules on an edit before it is written and refuses an edit to the rulebook outright.
- Reports as text, as one mark per claim, as JSON, and as a GitLab code quality artifact.
- The init command, which writes a rulebook by reading the shape a project already has.
- The explain command, which answers where a file belongs, where a new file may live, what a cut would cost, and which pairs of zones no rule refuses.
- The activate and agent-instructions commands, which hand an agent the shape of the project and the commands to reach for.
- The guides, copied into the package and read a page at a time with the docs command.

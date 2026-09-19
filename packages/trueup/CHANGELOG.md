# Changelog

## Unreleased

### Added

- Claims read the markdown a project names under `text`. They report a banned mark, a banned word, and a sentence or paragraph past a length limit. They also report an inline code span holding more than a path, and a link whose text says nothing about where it goes. The write-time guard rules on them too.
- A section that explains at length with nothing to look at is reported, which is the one prose claim that asks for something rather than banning it. It warns and never refuses an edit.
- The calibrate command prints the distribution behind each length limit, with the number of findings the configured limit and each percentile would report.
- Naming modules under `text.strings` holds the prose written into their strings to the same claims. It adds `no-prose-is-assembled-from-parts`, which asks that a passage is written as one string rather than joined when the code runs. A template carrying a value is read with the value blanked.
- Setting `comments` under `text` holds the comments in the code to the same claims. A parser finds them, so a marker inside a string is not one, and each comment is read on its own.

### Fixed

- Two delegated findings carrying the same message about one file need two baseline entries. Both were accepted on one, so the second passed as known.

## 0.4.0

### Added

- A zone written to serve the layer above it says so with `shared`, and the colocation check then counts parts of its consumer rather than zones. Where an isolation rule names siblings, the part is the sibling directory; where nothing groups the readers, it is the reading file. A component that several routes read is no longer reported, one that never leaves a single route still is, and the finding names the directory it belongs in.

### Changed

- The activate block marks a shared zone beside its role, so an agent can see why a component nothing else reads goes unreported.

## 0.3.0

### Added

- The github flag writes the report as SARIF, the format GitHub code scanning reads, so a finding lands on the line that caused it in a pull request. The remedy travels as the rule's help text, and a violation the baseline already accepted arrives as a warning rather than an error. A clean run still writes a run with no results, which is what closes the alerts a branch fixed.
- The npm page links to the guides and to the issue tracker, through homepage and bugs fields in the manifest.

### Changed

- The readme the npm page is built from lives at the root of the repository and is copied into the package when it is packed. Its links now point at the published guides rather than at files in the repository, so they resolve wherever the page is read.

## 0.2.0

### Fixed

- The explain command called with no path exits 4, an argument it does not know. It exited 3, which means no rulebook found.
- The json flag leaves out the guidance of a claim that found nothing. It carried every claim's guidance, which on a clean run was most of the output.
- A next filter naming no claim exits 4 on an otherwise clean run. It exited 0, so a typo passed as a clean check. A run with errors or a stale baseline keeps its own code.
- The boundary claim and the seam claim run only when `boundaries` or `seams` is set, as the guides already said. Both ran on every project and reported a pass on rules nobody had written.
- Two flags asking for different reports are refused with exit 4. One of them won quietly and the other was dropped.
- Accepting a baseline reports the entries it dropped as well as the ones it took. A run that only dropped entries said nothing new.
- An export that production reaches through a lazy import is no longer reported as one only tests use. The import names the module rather than a name inside it, so nothing in it says the tests are the only readers.
- A zone whose rule allows every other zone is no longer described as one no rule constrains. That line is how an unguarded zone is spotted, so it has to mean what it says.
- A claim name given to the docs command prints the page that explains that claim. It printed a list of every page mentioning the name and asked for one of them. Each guide names the claims it explains under `claims` in its frontmatter.

### Added

- The next flag takes the config key that turns a claim on, so `--next=seams`, `--next=duplication` and `--next=colocation` each reach their claim. A fragment of a claim name still works as before.
- The npm page links back to the source, through a repository field in the manifest.
- An import awaited while the program runs is an edge onto the module it names, so the boundary, cycle and isolation claims judge it. It was invisible. A specifier the program builds as it runs is still not followed.

### Changed

- The list shown when a next filter names no claim gives each claim the config key that turns it on.
- The coverage line counts the edges that reach a whole module rather than a name inside it. They were in the total and in none of the columns under it.
- The activate command groups the zones of a package under the path they share, and names a whole package once where a zone may reach all of it, as `server/*`. A reach covering most of the tree says what it leaves out instead, and a short reach is still listed. On a workspace of 50 zones the block went from 12936 to 10938 bytes.
- The remedy printed with a boundary finding names the api zone that closed the target, when the import crossed from one package to another. It described the refusal without naming the door.

## 0.1.0

The first published release.

### Added

- Zones, which name a group of files by where the files sit, and boundaries, which say what each zone may reach.
- A graph built from resolved symbols rather than from import text, so a chain of re-exports leads to the file where a name is actually written.
- Seam rules, which stop reusable code naming a domain concept it never imported. The vocabulary comes from the domain zone itself and is worked out on every run.
- Isolation rules, which keep sibling directories out of each other.
- Placement checks: a value declared away from its only reader, a file serving two readerships, and a test reaching an internal. The same group covers an export that exists only for a test, and a directory holding too many files.
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

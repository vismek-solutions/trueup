---
title: Rules you write yourself
description: Anything the config does not cover, written as a plain TypeScript function over your project.
---

Config covers direction and vocabulary. Anything else is a plain TypeScript function over the project, and you write it.

A rule goes in the rules key of your config, so the whole file reads:

```ts
import { defineConfig, defineRule } from "@vismek-solutions/trueup";

export default defineConfig({
  zones: [
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "app", patterns: ["src/**"] },
  ],
  rules: [
    defineRule("domain-is-entered-through-its-index", (project) =>
      project
        .imports({ declaredZone: "domain" })
        .filter((edge) => edge.fromZone !== "domain" && !edge.via.endsWith("domain/index.ts"))
        .map((edge) => ({
          message: `reaches ${edge.imported} without going through the index`,
          file: edge.from,
          at: edge.at,
        })),
    ),
  ],
});
```

Return a list of issues. A message on its own is enough. Adding file and at places the caret, and severity defaults to error.

## What an import gives you

Calling project.imports() with no argument returns every import in the project. You can narrow it by fromZone, declaredZone or kind. Each import carries:

| field | |
|---|---|
| `from` | the importing file |
| `fromZone` | its zone |
| `specifier` | the text as written in the import |
| `via` | the file that specifier resolved to, the barrel if there is one |
| `viaZone` | that file's zone |
| `imported` | the exported name asked for |
| `local` | the name it was bound to |
| `symbol` | the declared name, where the target is a single symbol |
| `declaredIn` | the file that actually declares it, after re-exports |
| `declaredZone` | that file's zone |
| `kind` | `"value"` or `"type"` |
| `at` | byte offset of the binding, for the caret |
| `target` | what the import landed on: a symbol, a whole namespace, something external, a Node builtin, a name the module does not export, or two candidates it could not choose between |

Two of those fields are worth a second look. A barrel is a file that re-exports its neighbours so people can import from one place. The field via is the module the author named, so it is often the barrel. The field declaredIn is where the thing really lives, after every re-export has been followed. Compare the two in your rules, because a tool that treats them as one is blind through a barrel.

## Give the rule a remedy

A third argument says what a violation means and how to fix it. Whoever hits the rule reads that instead of guessing.

```ts
defineRule(
  "domain-is-entered-through-its-index",
  (project) => /* the same function as above */,
  "Something reached past the domain's index into a file behind it, which fixes that file's path and name for every caller. Export what the caller needs from the index and import it from there.",
)
```

The message says what happened. The guidance says what to do, and where it matters, it names the fix that would make things worse.

A rule that reports more than one kind of problem can give each kind its own remedy. Pass a function in place of the string and it receives the issues the rule just returned:

```ts
defineRule(
  "domain-is-entered-through-its-index",
  (project) => /* the same function as above */,
  (issues) =>
    issues.length === 1
      ? "Export what this caller needs from the domain's index and import it from there."
      : "Several callers reach past the index. Work out what the index should publish, then move every caller onto it in one go.",
)
```

Whoever meets the rule then reads the advice for the case in front of them, rather than every case the rule can report.

## Rules see a model, not a syntax tree

Rules are handed a view of the project rather than a syntax tree. The parser stays an implementation detail you never have to learn, and swapping it never breaks a rule you wrote.

Besides the imports, a project will answer any of these:

| what you ask for | what comes back |
|---|---|
| `root` | the project root, as an absolute path |
| `files` | every file the run read |
| `assets` | every file read as text alone, never parsed, such as a stylesheet |
| `zoneNames` | every zone name, in the order you declared them |
| `zoneOf(file)` | the zone that file landed in, or nothing if no zone claimed it |
| `filesIn(zone)` | the files in one zone |
| `exportsOf(file)` | the names a file exports |
| `relative(file)` | that path relative to the project root, which is what you want in a message |
| `sourceOf(file)` | the text of a file, or nothing if the run never read it |
| `declarationsIn(file)` | each declaration in a file, with its name, its text, and where it starts and ends |
| `mentionsIn(file)` | every identifier and every string literal in a file, each with its position |
| `referencesIn(file)` | for each declaration in a file, which of the file's other declarations it mentions |
| `vocabularyOf(zones)` | the names those zones export, and the string values their files contain |

One of those deserves a warning. When you need the text of a file, ask sourceOf for it rather than reading the disk yourself.

The guard is the part that inspects an edit before it is saved. At that moment the file on disk still holds the old text, so a rule that reads the disk directly answers the opposite of what it answers in a full run. That is a hard thing to notice and a worse thing to debug.

## Files that are read but never parsed

A rule sometimes needs a file the parser never sees. A stylesheet is the usual case, because the classes in it constrain your components and no import connects the two.

Name those files and the run reads them as text:

```ts
assets: ["**/*.css"]
```

They stay apart from the code. Nothing parses them, they carry no imports, they are absent from the list of files, and they owe no zone, so a stylesheet never fails the check that every file belongs to one. A rule asks for them together:

```ts
defineRule(
  "no-stylesheet-forces-a-declaration",
  (project) =>
    project.assets
      .filter((sheet) => project.sourceOf(sheet)?.includes("!important") === true)
      .map((sheet) => ({ message: "forces a declaration", file: sheet })),
  "A forced declaration wins by weight rather than by position, so the next rule written for that element does nothing. Take the force off, and give the element a class of its own where it genuinely needs to win.",
)
```

The run then says so:

```
no-stylesheet-forces-a-declaration          1 error
    src/card.css  forces a declaration
```

The guard rules on a proposed stylesheet the same way, for the reason above: the text comes from the project, so the rule reads the edit rather than the copy still on disk.

## When to write one instead of asking for a feature

Write a rule when the constraint is specific to your project: a naming convention, an entry point everything must go through, a package that may only be imported from one place.

A claim is one sentence the tool believes about your project, which every run proves or disproves. A claim is built in when it is true of many projects, or when a rule cannot express it. Zone cycles are the second case. Finding one means walking the whole zone graph, and a rule only sees one import at a time.

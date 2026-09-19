---
title: Prose
description: The guides an agent writes, held to the same standard as its code.
claims:
  - no-prose-uses-a-banned-mark
  - no-prose-uses-a-banned-word
  - no-passage-runs-past-its-limit
  - no-inline-code-holds-more-than-a-path
---

An agent writes your guides as well as your code. The code has this tool watching it. The prose has a style guide somebody wrote once, and nothing that reads it.

These claims read the markdown in your project and hold it to rules you declare. They run in the same pass as every other check, and the write time guard refuses an edit that breaks one.

Here is a page an agent has just written:

```md
# Setting up

Install the tool and run it — it reads your config and tells you what is wrong.

The report names the claim, the file and the position, and then it prints the guidance that belongs to that claim so you do not have to go and look the meaning up somewhere else.
```

Two things are wrong with it, and neither is a matter of taste. The dash stands in for a mark the writer never chose, so a reader cannot tell whether a full stop or a colon was meant. The second sentence carries two ideas at once.

You say so in the config. The files key names the markdown to read, and every other key turns on one claim:

```ts
text: {
  files: ["docs/**/*.md"],
  marks: ["—", "–", "--"],
  maxSentenceWords: 30,
}
```

Now the run says so:

```
no-prose-uses-a-banned-mark                 1 error
    docs/setup.md:3:29  uses "—" where a full stop, a comma, a colon or a joining word would do
    ────────
    A mark the project banned stands in for a pause, which hides which of a full stop, a comma or a
    colon the sentence actually needed.

    Do this:
    - Split the sentence where the mark stands, or put a comma, a colon or a joining word there.
    - Put a genuine range or a compound word in inline code, which this check does not read.

    Not the fix: swapping one dash for a narrower one. Every mark the rulebook lists is off,
    whatever its width.

no-passage-runs-past-its-limit              1 error
    docs/setup.md:5:1  runs to 35 words in one sentence, more than the 30 allowed
    ────────
    A sentence or a paragraph runs past the limit this project set. No study establishes a length
    threshold, so the number is a house convention rather than a standard.

    Do this:
    - Cut what the sentence does not need. Shortening on its own is measured to buy nothing, so
      removing a clause beats moving it.
    - Keep the joining word if you do split. Deleting it drops the relation the sentence was
      carrying.
    - Break the paragraph where the subject changes, or move the extra sentences into a list.

    Not the fix: raising the limit. The number exists to force the question of what the sentence is
    for.
```

## What gets read

Only the prose. A fenced code block, a table, a blockquote and the frontmatter at the top of a page are all passed over. A command you quote is never judged as a sentence.

Inside a paragraph, three things are blanked before any claim looks: an inline code span, the target half of a link, and a bare URL. The label of a link is prose and stays. That is why a banned word in a code sample costs you nothing, and the same word in a sentence beside it is reported.

Headings and list items are read as passages of their own. A heading is one passage without its hashes, and a list item is one passage without its bullet.

## The claims

| claim | what it says | key |
|---|---|---|
| `no-prose-uses-a-banned-mark` | no sentence uses a mark you banned | `marks` |
| `no-prose-uses-a-banned-word` | no sentence uses a word you banned | `words` |
| `no-passage-runs-past-its-limit` | no sentence or paragraph is longer than you allow | `maxSentenceWords`, `maxParagraphSentences` |
| `no-inline-code-holds-more-than-a-path` | inline code holds a path, a command or a symbol, never a phrase | `maxInlineCodeWords` |

All four are exact, so they fail the run and the write time guard refuses the edit. Nothing here rests on a threshold tuned until it went quiet.

## Fixing one

For a mark, split the sentence where the dash stands, or put there the mark the sentence actually needed. Please do not swap the em dash for a shorter one. Every mark in your list is off, and the narrower dash reads the same way to somebody who has to guess what it meant.

For a long sentence, cut it at the joining word and give each half a full stop. For a long paragraph, break it where the subject changes, or turn the extra sentences into a list. Raising the number until the page passes is the one fix that leaves you worse off, because the number is the only thing forcing the split.

For a phrase in inline code, take the backticks off and let the words sit in the sentence. Inline code earns its place when a terminal can make the thing clickable, which is true of a path, a command and a symbol, and false of a sentence.

Better than fixing one is not writing it. The [session start block](/agents/instructions/) names the files held and every limit in force, so an agent reads the numbers before its first draft rather than meeting them in a refusal.

## Setting a limit you can defend

No study establishes a sentence length. The 20 and 25 words in the technical writing standards cite nothing. The 25 in the GOV.UK guide traces back through its own blog to a magazine article. A number copied from a style guide is a number with nothing behind it.

Take it from your own writing instead:

```sh
npx trueup calibrate
```

```
calibration  apps/docs/**/*.md · README.md

sentence words        1430 measured
  at 30 (configured) 52 over
  at 25 (p90) 131 over · at 29 (p95) 64 over · at 36 (p99) 12 over · at 59 (max) 0 over

paragraph sentences   556 measured
  at 5 (configured) 0 over
  at 4 (p90) 16 over · at 4 (p95) 16 over · at 5 (p99) 0 over · at 5 (max) 0 over

inline code words     0 measured

A limit taken from a percentile of your own writing is one you can defend.
No study establishes a length threshold, so a number from a style guide has nothing behind it.
```

The first line under each metric is where you are now. The second is what each percentile would cost you. Reading the example, tightening the sentence cap from 30 to 29 takes the backlog from 52 findings to 64, and loosening it to 36 cuts it to 12.

A metric reading nothing measured is one whose check is switched on with nothing to look at. That is worth seeing, because the alternative is a check you believe is working.

## When to turn it on

Turn it on when a guide in your repo is something a reader outside your team will see, and an agent is one of the people writing it. A README, a changelog and a documentation site all qualify. Notes nobody reads twice do not.

Start with marks and words. Both are exact, both are cheap to fix, and neither has an argument in it. A repo that already writes this way reports nothing on the first run, which is what you want from a rule that holds a line rather than opening a project.

Add the length limits next, and expect a backlog. No study establishes a length threshold, so take the number from your own writing rather than from a style guide. The ninety fifth percentile of your sentences is a defensible place to start. Record what stands in the baseline and let the number hold from there.

The word list takes the plainer word beside the one it replaces, so the finding can say what to write instead:

```ts
words: [
  { word: "leverage", instead: "use" },
  { word: "utilize", instead: "use" },
]
```

One caution on inline code. The check reports a run of plain lowercase words past the limit, and it counts a token carrying a slash, a dot or a dash as code rather than prose. A command of five or more plain words with no flag and no path would be reported. Raise the limit or leave that claim off if you write many of those.

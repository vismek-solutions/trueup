# What the claims never said

A claim that reports nothing looks the same whether the text is clean or the reader walked past the
violation. This looks for the second case. It reads markdown nobody wrote for this tool and finds
everything that looks like a violation. Then it subtracts what the claims reported, and a model judges
whether the checker was right to stay quiet about the rest.

```sh
pnpm recall
```

Every verdict is written to a json file beside the run, with the lines it was judged on. Four
environment variables change what it reads:

```
RECALL_PAGES       how many markdown files to sample
RECALL_PER_CLAIM   how many candidates to judge per claim
RECALL_CORPUS      where to read markdown from
RECALL_MODEL       which model judges
```

## What counts as a candidate

The detectors here are deliberately dumb, and they share nothing with the reader they audit. A
candidate is any of these:

```
an occurrence of a banned mark
an occurrence of a banned word
a run of words between two full stops that passes the sentence limit
a code span holding more words than the limit allows
```

They read the whole file apart from fenced blocks and frontmatter, and they treat a blank line as the
end of a paragraph. Everything else stays in: tables, html, lists, headings, link targets, inline
code. That is the point, since those are where a reader walks past something.

## Reading a missed verdict

A candidate the checker said nothing about is usually correct. The mark sits in a table, the long
sentence is a line of yaml, the word is inside a url. The interesting case is the other one, and it
names a place the reader does not reach at all.

The judged sample is drawn from the candidates in corpus order, so a claim with thousands of
candidates is measured on the first thirty rather than on a spread. Read the lines in the json file
before acting on a verdict.

## What this cannot see

A violation the checker reported in the wrong place, or with the wrong count, counts as covered here.
Coverage asks only whether some finding of that claim landed inside the candidate, so a sentence
reported three words short still passes. The precision run is what catches that.

The link claim has no detector. Its closed list of words lives inside the tool, the scripts here may
not reach it, and a second copy is what the duplication claim refuses.

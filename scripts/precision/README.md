# How often is a finding right

Four of the prose claims refuse a write, and nothing said how often that refusal is wrong. This reads
markdown nobody wrote for this tool, runs the claims over it, and has a model judge each finding
against the lines it names.

```sh
pnpm precision
```

Every verdict is written to a json file beside the run, with the lines it was judged on, so a number
can be checked rather than trusted. Four environment variables change what it reads:

```
PRECISION_PAGES       how many markdown files to sample
PRECISION_PER_CLAIM   how many findings to judge per claim
PRECISION_CORPUS      where to read markdown from
PRECISION_MODEL       which model judges
```

The corpus is the markdown already in node_modules. That is hundreds of readmes by many hands, in
several languages, and none of it was written to please this project.

## What it judges

The question is narrow. Is the thing the message describes really there, in the prose, at that line.

A finding is wrong when what it points at sits in a fenced block, a table, frontmatter, inline code, a
URL or a link target. It is also wrong when the thing is not there at all. Whether a rule is worth
having is a separate question, and reading settles that one.

## Reading a wrong verdict

A wrong verdict is usually a bug in the reader rather than a bad rule. The fix belongs in the module
that reads the markdown, with a test that fails without it. The corpus holds the cases our own guides
never produce:

```
a sentence ending in a danda rather than a full stop
a full stop swallowed by the url in front of it
a dash that is really a command line flag
a heading underlined with equals signs
```

The labels are not certain either. Read the lines in the json file before acting on a verdict, since
the model gets one window and can miss what sits far along a long line.

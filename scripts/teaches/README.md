# Does a guide teach what it claims

Every prose check judges the words on a page. This one uses the page instead. It hands a model the
page and one task, then runs the tool against whatever rulebook comes back.

```sh
pnpm teaches
pnpm teaches isolation
```

A case passes when the claim it names fires on the file it names. A rulebook that declares nothing
satisfies the tool and fails the case, which is the point.

It calls the local claude command, so it needs no key, and it costs one model call per case. Set
TEACHES_MODEL to compare one model against another.

## Writing a case

A case is a directory under fixtures, holding three things:

```
scripts/teaches/fixtures/isolation/
  case.json    the pages the reader was given, the claim that must fire, the file it must name
  task.md      what the reader is asked to do
  tree/        the project, with the violation already in it
```

Name every page a reader would have reached by then. The guides have an order, and a single page is a
stricter test than the site gives anyone.

## Reading a failure

A failure prints the directory it ran in. That directory holds the answer the model gave and the
rulebook taken from it. The first question is whether the page left something out, or the case asked
for what the page never promised.

The harness is not deterministic. A case that passes today can fail tomorrow on the same page, which
is why it runs by hand rather than in the checks a commit has to pass.

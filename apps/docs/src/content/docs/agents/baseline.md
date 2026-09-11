---
title: Starting on the code you already have
description: Write down what is already there, then hold the line from today.
---

A first run on a codebase with some history behind it will find plenty. That is expected, and it says nothing about how well you work. Almost nobody starts clean.

So the first move is not to fix anything. It is to write down what is already there.

```sh
npx trueup --update-baseline
```

That writes trueup.baseline.json next to your config, listing the violations that existed when you started. **Commit it.** It is a shared record of what the team has agreed to live with, and a per-developer copy would mean everyone's build failed differently.

From then on, a new violation fails the build. A recorded one prints as a warning, so it stays visible rather than hidden, and nobody forgets the debt is there.

Nothing in that file is a promise to fix it this week. It is a note saying you have seen it.

## What the run says it accepted

The first run has nothing to compare against, so it counts what it took, one line per claim:

```
accepted 1 finding into trueup.baseline.json · the first baseline

every-import-respects-its-zone-boundary     1 new
```

Every run after that names each entry it added:

```
accepted 2 findings into trueup.baseline.json · 1 new

every-import-respects-its-zone-boundary     1 new
    src/engine/report.ts  is engine and may not reach domain: thing from src/domain/thing.ts
```

That list is what makes the commit reviewable. A baseline that grows is a decision to live with something new, and whoever reads the commit should be able to see what it was. When the run accepts only what the file already held, it says so in one line:

```
accepted 2 findings into trueup.baseline.json · nothing new
```

## When you fix one

If you fix a violation that was in the baseline, the run exits with code 2 and tells you to update the file. Nothing has gone wrong. The list has grown shorter, and the record needs to catch up.

Sometimes an entry stops matching and nothing was fixed. Upgrading the tool can change how a claim words a finding, and the message is part of what an entry remembers, so the old entry falls away while the same violation comes back under new words. The run tells the two apart for you. An entry saying the claim no longer reports on that file is a fix. One saying the claim still reports on that file in other words is not, and updating the baseline records the new wording rather than dropping anything.

The [write time guard](/agents/guard/) reads the same signal, so it lets through the edit that did the re-wording. Otherwise a fix that only gets halfway would be refused for the wording it leaves behind.

Without that, a baseline slowly turns into a list of permanent exemptions nobody dares delete.

## What an entry remembers

An entry is keyed on three things: the claim, the file and the message. A claim is one sentence the tool believes about your project, which each run proves or disproves.

A line number is never part of the key, so moving code around does not churn the file.

A message that changes wording no longer matches. If a claim now says something different about a finding, that is a new fact and deserves a fresh look.

A few claims are the exception, and they are the ones that report at most one thing about a file. A file serving two readerships, or a directory holding too many files, gets one finding and the message spells out the current detail: which exports, how many files. That detail moves while the problem stands, so for those claims the file alone is the key. Half fixing one of them stops reading as a brand new violation, and the entry stays accepted until the finding is gone.

Some claims are never baselined at all. The one asserting the analysis reached files, and the one asserting every delegated tool ran, are both left out. A run where nothing was analysed can never be recorded, so a broken config cannot silently baseline your whole project.

## Why there are no suppression comments

The baseline is the only way to accept a finding. There is no comment you can put in a file to make one go quiet.

An inline comment sits next to the code it excuses, and nothing ever revisits it. A baseline entry sits in one file you can read end to end, and it goes stale loudly the moment the violation is gone.

:::caution
Please do not baseline an import that fails to resolve because your build tool is the one supplying it. It fails on every run, so the entry never goes stale, and the next real typo lands in the same silence. Declare it in [externals](/concepts/boundaries/#imports-your-build-tool-supplies) instead.
:::

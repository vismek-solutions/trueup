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

## When you fix one

If you fix a violation that was in the baseline, the run exits with code 2 and tells you to update the file. Nothing has gone wrong. The list has grown shorter, and the record needs to catch up.

Without that, a baseline slowly turns into a list of permanent exemptions nobody dares delete.

## What an entry remembers

An entry is keyed on three things: the claim, the file and the message. A claim is one sentence the tool believes about your project, which each run proves or disproves.

A line number is never part of the key, so moving code around does not churn the file.

A message that changes wording no longer matches. If a claim now says something different about a finding, that is a new fact and deserves a fresh look.

Some claims are never baselined at all. The one asserting the analysis reached files, and the one asserting every delegated tool ran, are both left out. A run where nothing was analysed can never be recorded, so a broken config cannot silently baseline your whole project.

## Why there are no suppression comments

The baseline is the only way to accept a finding. There is no comment you can put in a file to make one go quiet.

An inline comment sits next to the code it excuses, and nothing ever revisits it. A baseline entry sits in one file you can read end to end, and it goes stale loudly the moment the violation is gone.

:::caution
Please do not baseline an import that fails to resolve because your build tool is the one supplying it. It fails on every run, so the entry never goes stale, and the next real typo lands in the same silence. Declare it in [externals](/concepts/boundaries/#imports-your-build-tool-supplies) instead.
:::

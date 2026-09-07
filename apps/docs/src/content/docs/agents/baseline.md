---
title: Adopting on an existing codebase
description: Record what is already there, then hold the line.
---

Almost nobody starts clean. Record what is already there, then hold the line.

```sh
npx trueline --update-baseline
```

The **baseline** is a file listing the violations that existed when you started.

From then on, a new violation fails the build. A recorded one prints as a warning — visible, not hidden, so nobody forgets the debt is there.

## When you fix something

If you fix a violation that was in the baseline, the run exits `2` and tells you to update it.

That sounds fussy, and it is the entire point. Without it, a baseline slowly turns into a list of permanent exemptions nobody dares delete.

## What an entry is keyed on

Entries are keyed on the claim, the file and the message. Never on a line number, so moving code around does not churn the file.

A message that changes wording no longer matches, which is deliberate: if a claim now says something different about a finding, that is a new fact and deserves a fresh look.

Two claims are never baselined — the one asserting the analysis reached files, and the one asserting every delegated tool ran. A run where nothing was analysed can never be recorded, so a broken config cannot silently baseline your whole project.

## There are no suppression comments

The baseline is the only way to accept a finding. That is a deliberate omission rather than a missing feature.

An inline comment sits next to the code it excuses, and nothing ever revisits it. A baseline entry sits in one file you can read end to end, and it goes stale loudly the moment the violation is gone.

:::caution
Do not baseline a build-time specifier that fails to resolve. It fails on every run, so the entry never goes stale, and the next real typo lands in the same silence. Declare it in [`externals`](/concepts/boundaries/#imports-your-build-tool-supplies) instead.
:::

---
title: Stopping an edit before it lands
description: A check that reads a proposed edit, works out what it would do, and can turn it down.
claims:
  - no-edit-changes-the-rules-themselves
---

Claude Code can run a command of your choosing before it saves a file, and cancel the write if that command objects. The guard is that command.

It reads the edit the agent is proposing, applies it to a copy of the file in memory, and checks the result against the rest of your project. Your file on disk is untouched while that happens. It does not even have to exist yet.

## Setting up the hook

The settings go in .claude/settings.json in your project root. Create the file if it is not there. If it already has a hooks key, merge these entries into it rather than replacing them.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|mcp__serena__replace_content",
        "hooks": [{ "type": "command", "command": "npx trueup guard" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__serena__(replace_content|replace_symbol_body|replace_in_files|insert_after_symbol|insert_before_symbol|rename_symbol|safe_delete_symbol)",
        "hooks": [{ "type": "command", "command": "npx trueup guard" }]
      }
    ]
  }
}
```

The agent gets the refusal as its tool result, carrying the same explanation the report prints. It corrects course inside the same turn. Nothing lands on disk, and nothing has to travel through you first.

A refusal ends with what the file may reach, not only with what it may not.

```
every-import-respects-its-zone-boundary  src/engine/table.ts
  is engine and may not reach domain: Warrant from src/domain/warrant.ts
  ────────
  Code in one zone reached a symbol declared in a zone it may not reach. …

engine may reach engine · shared
```

An agent that hears only no will guess at where the code should go instead. That one line of allowed zones saves it the guess.

The second block is there only for [Serena](https://github.com/oraios/serena), an MCP server that edits code through a language server. If you have not deliberately installed it, you do not have it, so drop that block. The first matcher, the one covering Write and Edit, covers everything else.

## What blocks and what does not

Only findings on the file being written can block it. A violation somewhere else is not this edit's problem, and if it were enough to block, no edit in an existing codebase would ever land.

The hook payload arrives on standard input, so you can try a proposed edit by hand:

```sh
npx trueup guard < add-price-to-cart.json
```

```
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"This edit is refused by the project's architecture rules.\n\nevery-import-respects-its-zone-boundary  src/api/cart.ts\n  is api and may not reach domain: priceOf from src/domain/price.ts …"}}
```

Anything already in your baseline does not block either. A baseline is the recorded list of problems you have agreed to live with for now. Run the same command on an edit that leaves a recorded finding where it was, and it prints nothing at all.

A recorded finding that comes back under different words does not block either, and that matters for a fix landing in stages. The edit closes part of what a check was saying, the check then says something different about the same file, and the new wording is in no baseline. Refusing it would make the improving edit the one edit you cannot make.

So when a claim retires one of its own baseline entries on that file in the same run, the finding left standing counts as the recorded one under new words. A claim that retired nothing is forgiven nothing, and a full run still fails until the baseline catches up.

One rule stands down for a file that does not exist yet. A new file holding a declaration that still stands somewhere else is a move half done, and it is impossible to tell from a copy until the old one is deleted. Blocking it had a worse effect than letting it through: it taught agents to reword the body until it stopped matching, which leaves two copies and no finding. So the write lands, and [the duplication check](/checks/duplication/) keeps failing until the old copy is gone. Every other rule still applies to that file, and a copy landing in a file that already exists is still refused.

When the guard cannot make sense of the situation, it stands aside and lets the write happen. An edit it cannot read, a missing config, a file type you do not analyse: each of those allows the write. A guard that fell over on surprises would block every edit rather than the wrong ones.

## The rulebook goes through you

Your rulebook is the file your rules are read from, either at the root of the project or inside one package. Any rule on this site can be switched off by editing it.

An edit to the rulebook is the one edit the guard will not settle by itself. It stops that edit, and hands the decision to you.

Two files are covered with no configuration at all: the rulebook the rules were read from, and the baseline. Those are the two ways to make a failing check pass without touching any code. You can widen the boundary that objected, or you can record the violation as already known.

The default is a permission prompt, not a refusal.

```
This edit needs your approval under the project's architecture rules.

no-edit-changes-the-rules-themselves  trueup.config.ts
  An agent is asking to change a file the project's rules are read from.

  Approve it if this is setup, or a change to the rules you meant to make.

  Refuse it if a check was failing just before this. Editing the rulebook is how a failing check
  gets switched off, and it leaves no trace that it ever failed.
```

That keeps setup work possible. An agent can draft your zones, add one for a new directory, or wire up the hooks, and you approve each one. What it cannot do is quietly widen a rule that is failing right now, because the request reaches you along with the reason to look twice.

Anything else that should come to you first, you can name.

```ts
protect: [".claude/settings.json", ".github/workflows/**", "CLAUDE.md"]
```

Copy the hook settings entry at least. Without it, the shortest way past the guard is to turn the guard off.

## When nobody is there to answer

A prompt is a gate only while someone is at the keyboard. In the permission modes that ask you nothing, acceptEdits, auto, dontAsk and bypassPermissions, the prompt becomes a refusal on its own. You do not configure that. An unanswered prompt never turns into an approval either, because waiting would be a way past the guard.

That leaves default mode with nobody at the desk. The prompt waits, and so does the agent. If that costs you more than agent-driven setup is worth, ask for a refusal outright.

```ts
protect: { paths: ["CLAUDE.md"], decision: "deny" }
```

A decision on its own hardens the rulebook and the baseline without naming anything else, and it can depend on where the run is happening.

```ts
protect: { decision: process.env.CI === undefined ? "ask" : "deny" }
```

## Handing the rulebook over

The opposite is available too. It is the answer if the prompt is friction you do not want, because you read the rulebook diff on the merge request anyway, or because you run unattended and would rather the agent kept going.

```ts
protect: { decision: "allow" }
```

An agent may then edit the rulebook and the baseline freely, in every permission mode. Every rule on this site becomes optional to the thing it is meant to constrain. An agent told to get the build green can widen the boundary it broke a moment ago, or record the violation as already known, and both are one edit away.

So the report says so, on every run.

```
coverage  1 files · 0 edges · 0 symbol · 0 namespace · 0 external · 0 builtin · 0 unresolved
zones     all 1 · 0 unclassified
notice    the rulebook is unguarded: an agent may edit this config and the baseline
```

Choose allow when you have decided that a later review is your gate. If what you want is only for setup not to block overnight, ask is the setting for that.

## Files the analysis never reads

The guard runs before the filters for roots and file extensions, so it also covers files the analysis would never open: a JSON file, a YAML file, anything outside the include setting.

It has no counterpart in a full run, because a snapshot of your code cannot show that the rulebook was edited on the way. This is the only rule that exists purely at write time.

You still edit these files yourself, directly. The hook only sees what an agent does.

## Why there are two hooks

The guard has to know what the file would look like after the edit. A find and replace is something it can reproduce exactly, so edits of that kind are checked before the write and refused. An edit such as "replace this function's body" depends on the language server's idea of where the function ends, so those are checked immediately after the write and come back as a correction. The guard never guesses at how another tool's edits work.

Delegated tools do not run here. A runner hands a job to another tool you already use, and starting a whole-repo lint on every edit would cost far more than it catches.

---
title: Blocking a bad edit
description: A hook that judges a proposed write before it reaches disk, and refuses it.
---

This is the part that matters most if you are working with an agent.

Claude Code can run a command before it writes a file, and cancel the write if that command objects. `trueline guard` is that command.

It reads the proposed edit, applies it to a copy of the file in memory, and checks the *result* against the real project. The file never has to exist on disk.

## The hook

This goes in `.claude/settings.json` in your project root. Create the file if it is not there; if it already has a `hooks` key, merge these entries into it rather than replacing them.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|mcp__serena__replace_content",
        "hooks": [{ "type": "command", "command": "npx trueline guard" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__serena__(replace_content|replace_symbol_body|replace_in_files|insert_after_symbol|insert_before_symbol|rename_symbol|safe_delete_symbol)",
        "hooks": [{ "type": "command", "command": "npx trueline guard" }]
      }
    ]
  }
}
```

The agent gets the refusal as its tool result, carrying the same explanation the report prints. It corrects course inside the same turn. Nothing lands on disk, and no round trip through you is needed.

The refusal ends with what the file *may* reach, not just what it may not.

```
every-import-respects-its-zone-boundary  src/engine/table.ts
  is engine and may not reach domain: Warrant from src/domain/warrant.ts
  Code in one zone reached a symbol declared in a zone it may not reach. …
engine may reach engine · shared
```

The moment an agent has been refused is the moment it is about to guess. Telling it where it may go costs one line and saves the turn spent guessing wrong.

The second block is only for [Serena](https://github.com/oraios/serena), an MCP server that edits code through a language server. If you have not deliberately installed it, you do not have it — drop that block and keep the `Write|Edit` matcher, which covers everything else.

## What can and cannot block

Only findings on the file being written can block it. Someone else's standing violation is not this edit's problem, and blocking on one would make every edit in an existing codebase impossible.

Anything already in the baseline does not block either.

An unusable payload, a missing config, a file type you do not analyse — all of those allow the write. A guard that errors would block *every* edit rather than the wrong ones.

## The rulebook goes through you

Every other rule can be switched off by editing the config, so the guard stops that edit and hands it to you.

Two files are covered with no configuration at all: the config the rules were read from, and the baseline. Those are the two ways to make a failing check pass without touching any code — widen the boundary, or record the violation as already known.

The default is a permission prompt, not a refusal.

```
This edit needs your approval under the project's architecture rules.

no-edit-changes-the-rules-themselves  trueline.config.ts
  An agent is asking to change a file the project's rules are read from. Approve it if this is
  setup, or a change to the rules you meant to make. Refuse it if a check was failing just before
  this: editing the rulebook is how a failing check gets switched off, and it leaves no trace that
  it ever failed.
```

That keeps setup work possible. An agent can draft your zones, add one for a directory you just made, or wire the hooks — you approve each one. What it cannot do is quietly widen a rule that is red right now, because you see the request and the reason for suspecting it.

Add anything else that should come to you first.

```ts
protect: [".claude/settings.json", ".github/workflows/**", "CLAUDE.md"]
```

The hook settings are the entry worth copying. Without them, the shortest way past the guard is to turn the guard off.

## When nobody is there to answer

A prompt is only a gate while someone is at the keyboard. Claude Code runs in one of several permission modes, and in the ones that stop asking a person — `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions` — the ask is downgraded to a refusal automatically. You do not configure that, and you do not need to know which mode you are in for it to hold.

A prompt also cannot be waited out. Nothing turns an unanswered one into an approval, because waiting would then be the way past the guard.

What is left is the case where you are in `default` mode but away from the desk. The prompt sits there, and the agent sits with it. If that matters more to you than agent-driven setup, ask for a refusal outright.

```ts
protect: { paths: ["CLAUDE.md"], decision: "deny" }
```

`decision` on its own hardens the config and the baseline without naming anything else.

```ts
protect: { decision: process.env.CI === undefined ? "ask" : "deny" }
```

## Two things this check does differently

It runs before the roots and extension filters, so it covers files the analysis would never look at — a `.json`, a `.yml`, anything outside `include`.

It has no counterpart in a full run, because a snapshot of the code cannot show that the config was edited. This is the only rule that exists purely at write time.

You still edit these files yourself, directly. The hook only sees what an agent does.

## Why there are two hooks

To judge an edit before it happens, the guard has to work out what the file would look like afterwards.

For a plain find-and-replace, that is straightforward. For an edit expressed as "replace the body of this function", it is not. That needs the language server's idea of where the function starts and ends, which lives inside the editing tool rather than here.

So tools whose result can be reproduced exactly are checked *before* the write, and can be refused. Everything else is checked immediately *after* the write, against the real file, and comes back as a correction rather than a refusal.

The guard never guesses at another tool's edit semantics. Guessing is how this class of tool goes quietly wrong.

Delegated tools do not run here. Spawning a whole-repo lint on every edit costs far more than it catches.

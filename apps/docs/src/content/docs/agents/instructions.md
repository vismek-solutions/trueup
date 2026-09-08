---
title: Teaching the agent up front
description: Give the agent the shape before it starts, rather than one refusal at a time.
---

```sh
npx trueup agent-instructions >> CLAUDE.md
```

```markdown
## Architecture

This project's structure is enforced. Zones: spec, components, hooks, api, domain, app, server.

- `trueup explain <file>` — run this **before** creating or moving a file. It reports the zone that
  path falls into, which zones it may and may not reach, and the vocabulary it may not name.
- `trueup --dots` — check the whole project. Run it before calling a change done. It prints
  one character per claim and explains only what failed.

Every finding is printed with an explanation of what it means and how to resolve it. Read that
explanation before changing anything.

Fix the code, not the rule. Widening a boundary, adding a word to an allow list, or recording a
violation in the baseline to make a check pass defeats the check. If a rule looks wrong, say so
and leave it failing rather than editing it to be quiet.
```

The zone list comes from your config, and the command name from [`command`](/reference/config/) — so the block names how *your* project runs it.

`CLAUDE.md` is a file in your project root that Claude Code reads at the start of every session. Create it if you do not have one. For a different agent, append the same output to whatever file it reads; the block is plain markdown and names no tool.

[Blocking an edit](/agents/guard/) teaches the agent one rule at a time, at the moment it breaks it. This teaches it the shape before it starts.

## Why the instruction is always the same

An agent under pressure to make the output green has two ways to get there. One is to fix the code. The other is to widen the rule that objected.

The second is faster, looks like progress, and leaves no trace that a check ever failed. So every message this tool prints says which one is meant, the guidance on every claim names the fix that would make things worse, and the rulebook itself is [protected from agent edits](/agents/guard/#the-rulebook-goes-through-you).

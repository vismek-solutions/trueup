---
title: Teaching the agent up front
description: Give the agent the shape before it starts, rather than one refusal at a time.
---

```sh
npx trueline agent-instructions >> CLAUDE.md
```

`CLAUDE.md` is a file in your project root that Claude Code reads at the start of every session. Create it if you do not have one. If your team uses a different agent, append the same output to whatever file it reads instead — the block is plain markdown and names no tool.

This prints a short block naming your zones, the two commands worth running, and the instruction that matters most: fix the code, not the rule.

[Blocking an edit](/agents/guard/) teaches the agent one rule at a time, at the moment it breaks it. This teaches it the shape before it starts.

## The two commands worth handing over

```sh
npx trueline --dots
```

Cheap enough to run after every change.

```sh
npx trueline explain src/engine/newThing.ts
```

Run before creating a file, it answers where the file may live and what it may reach. A path in no zone says so.

## Why the instruction is always the same

An agent under pressure to make the output green has two ways to do it. One is to fix the code. The other is to widen the rule that objected.

The second is faster, looks like progress, and leaves no trace that a check ever failed. So every message this tool prints says which one is meant, the guidance on every claim names the fix that would make things worse, and the rulebook itself is [protected from agent edits](/agents/guard/#the-rulebook-goes-through-you).

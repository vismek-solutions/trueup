---
title: Teaching the agent up front
description: Give the agent the shape before it starts, rather than one refusal at a time.
---

```sh
npx trueline agent-instructions >> CLAUDE.md
```

This prints a short block naming your zones, the two commands worth running, and the instruction that matters most: fix the code, not the rule.

[Blocking an edit](/agents/guard/) teaches the agent one rule at a time, at the moment it breaks it. This teaches it the shape before it starts.

## The two commands worth handing over

```sh
npx trueline --dots
```

A green run costs two lines instead of twenty, which is what you want from something an agent runs after every change.

```sh
npx trueline explain src/engine/newThing.ts
```

Asked *before* creating a file, this answers where the file may live and what it may reach. A path in no zone is reported as such — which is the answer you want before making a directory nothing covers.

## Why the instruction is always the same

An agent under pressure to make the output green has two ways to do it. One is to fix the code. The other is to widen the rule that objected.

The second is faster, looks like progress, and leaves no trace that a check ever failed. So every message this tool prints says which one is meant, the guidance on every claim names the fix that would make things worse, and the rulebook itself is [protected from agent edits](/agents/guard/#the-rulebook-goes-through-you).

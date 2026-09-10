---
title: Teaching the agent up front
description: Give your agent the shape of the project before it starts writing.
---

An agent that knows the shape of your project before it writes anything will break fewer rules. One command writes that briefing for you, into the file your agent already reads.

```sh
npx trueup agent-instructions >> CLAUDE.md
```

Here is what it appends.

```markdown
## Architecture

This project's structure is enforced. Zones: spec, components, hooks, api, domain, app, server.

- `trueup explain <file>` — run this **before** creating or moving a file. It reports the zone that
  path falls into, which zones it may and may not reach, and the vocabulary it may not name.
- `trueup explain --needs=<file>,<file>` — where a new file may live, given what it must import.
  Add `--read-by=<file>` for what will import it. When no zone can hold it, it says what to split.
- `trueup --dots` — check the whole project. Run it before calling a change done. It prints
  one character per claim and explains only what failed.
- `trueup --next` — the first problem to fix, with its remedy. `--next=<claim>` picks the claim.
- `trueup docs <topic>` — the guide behind a claim, when its printed remedy is not enough.
  Run it with no topic to list the pages; a claim name works as a topic.

Every finding is printed with an explanation of what it means and how to resolve it. Read that
explanation before changing anything.

Fix the code, not the rule. Widening a boundary, adding a word to an allow list, or recording a
violation in the baseline to make a check pass defeats the check. If a rule looks wrong, say so
and leave it failing rather than editing it to be quiet.
```

A zone is a name you give to a group of files, chosen by where the files sit. The zone list here comes from your own config, and the command name from the [command setting](/reference/config/), so the block names the way your project runs trueup.

CLAUDE.md is a file in your project root that Claude Code reads at the start of every session. Create it if you do not have one. For a different agent, append the same output to whatever file that agent reads. The block is plain markdown and names no tool.

[Blocking an edit](/agents/guard/) teaches the agent one rule at a time, at the moment it breaks it. This teaches it the shape before it starts.

## Handing an agent the whole shape

The briefing above is short on purpose. Sometimes you want the opposite, which is everything actually in force, printed in full.

```sh
npx trueup activate
```

You get every zone with the number of files in it, the reach each zone has left once all the rules have been combined, and which settings are switched on. That combining is the part worth having. A zone's real reach is rarely what any single rule says, because rules narrow each other, and in a workspace the root can narrow what a package granted itself. A list of rules is something an agent has to work out. A list of reaches is something it can act on.

Put it in a hook and your agent is handed all of that at the start of every session, with nobody remembering to paste anything:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [{ "type": "command", "command": "npx trueup activate" }]
      }
    ]
  }
}
```

## The guides travel with the package

An agent that meets a rule it has not seen before can read the page about it without leaving the
terminal. These guides are installed alongside the tool, so they answer for the version the project
has rather than for whatever the site says today.

```sh
npx trueup docs
```

That lists every page with one line about each. Name one and it prints in full.

```sh
npx trueup docs seams
```

A claim name works in the same place, because the lookup falls back to searching the pages for it.
Where more than one page mentions it, you get those pages listed rather than a guess.

## Why every message says the same thing

An agent under pressure to make the output green has two ways to get there. One is to fix the code. The other is to widen the rule that objected.

The second is faster, looks like progress, and leaves no trace that a check ever failed. It is an easy road to take, and not only for an agent.

So every message this tool prints says which of the two is meant. The guidance on every claim names the fix that would make things worse. And the rulebook itself is [protected from agent edits](/agents/guard/#the-rulebook-goes-through-you).

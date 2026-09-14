# Working in this repository

The checker, the CLI and the write-time guard live in `packages/trueup`. The guides live in
`apps/docs/src/content/docs` and are the product's public surface, not a side artifact.

## The docs are part of the change

Nothing verifies that the guides match the tool. Automating that comparison was considered and
turned down, so it falls to whoever makes the change. Any of the following is unfinished until the
matching page changes in the same commit.

Paths below are relative to `apps/docs/src/content/docs`.

| what you changed | what must change with it |
|---|---|
| a command or a flag in `src/cli/help.ts` | the "Command line" table in `reference/config.md` |
| a command an agent should reach for | a line in the advice block, `src/cli/agent-instructions.ts` |
| the advice block | its captured copy in `agents/instructions.md` |
| an exit code | the "Exit codes" table in `start/reports.md` |
| a root config key in `src/config/keys.ts` | the "Root config" table in `reference/config.md` |
| a member config key in `src/config/keys.ts` | the "Members" section in `reference/config.md` |
| a claim name | the claim table in `checks/index.md`, and the page explaining that claim, which names it under `claims` in its frontmatter so `trueup docs <claim>` reaches it |
| what turns a claim on | the "What turns each one on" table in `checks/index.md` |
| the guidance printed with a claim | the page describing that claim's remedy |

`changes` in `ROOT` is the injected port for reading the git diff rather than a user setting, so it
has no page and should not get one. A new key of that kind is the only sort that stays undocumented.

Changing what the tool prints also ages the captured output blocks on those pages. Reading a page
end to end is how you find them, since they carry no marker.

## Writing the page

Read two or three of the existing pages before writing one, and follow their shape. `checks/seams.md`
is the shortest complete example: what the thing is and why, the config that switches it on, a
captured report showing a finding, how to fix it including the fix that looks right and is not, and
when to turn it on. `concepts/zones.md` is the model for a page explaining an idea rather than a
check.

Two habits of those pages are easy to miss, because both show up as an absence. No dash is used as
punctuation, and anything longer than a path or a command gets its own block instead of sitting
inside a sentence.

Example output is captured by running the tool against a fixture, never written from memory.
Invented output has been wrong every time.

## Before calling a change done

```
pnpm run check
pnpm test
pnpm typecheck
```

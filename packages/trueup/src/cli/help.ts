import { DEFAULT_COMMAND } from "../report/invocation.ts";

const OPTIONS: Record<string, string> = {
  "--dots": "one mark per claim, with detail only for what failed",
  "--next": "the first problem to fix, with the remedy for it",
  "--next=<claim>": "the first problem from a claim <claim> names or turns on",
  "--json": "the whole report as JSON",
  "--gitlab": "the report as a GitLab code quality artifact",
  "--github": "the report as SARIF, for GitHub code scanning",
  "--update-baseline": "accept every finding standing now, so only new ones fail",
  "--config=<path>": "read this rulebook instead of searching upward for one",
  "--help": "this text",
};

const COMMANDS: Record<string, string> = {
  init: "write a rulebook for this project by reading its shape",
  "explain <path>[#<name>]": "the zone a path falls in; with a name, who reads it and what a cut costs",
  "explain --needs=<paths>": "where a file reaching those may live; --read-by=<paths> narrows it",
  "explain --ungoverned": "zone pairs whose traffic no boundary rule refuses, heaviest first",
  activate: "every zone, boundary and setting in force, for an agent's context",
  guard: "rule on a proposed edit, reading a hook payload from stdin",
  "agent-instructions": "a short block to paste into an agent's memory file",
  "docs [<topic>]": "the guides that ship with this version, one page at a time",
};

const WIDTH = 24;

const listed = (entries: Record<string, string>): readonly string[] =>
  Object.entries(entries).map(([name, said]) => `  ${name.padEnd(WIDTH)}${said}`);

export const helpLines = (): readonly string[] => [
  `${DEFAULT_COMMAND} — checks that the code matches the architecture its rulebook describes`,
  "",
  `usage: ${DEFAULT_COMMAND} [options]`,
  `       ${DEFAULT_COMMAND} <command> [arguments]`,
  "",
  "options",
  ...listed(OPTIONS),
  "",
  "commands",
  ...listed(COMMANDS),
  "",
  "Exit codes: 0 clean · 1 errors · 2 the baseline has entries nothing reports any more ·",
  "3 no rulebook found · 4 an argument it does not know · 5 the rulebook would not load.",
];

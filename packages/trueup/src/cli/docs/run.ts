import { existsSync } from "node:fs";
import { DEFAULT_COMMAND } from "../../report/invocation.ts";
import { EXIT_BAD_USAGE, EXIT_CLEAN, EXIT_ERRORS, type CommandInput } from "../command.ts";
import { pagesIn } from "./location.ts";
import type { Page } from "./page.ts";
import { allPages } from "./pages.ts";

const WIDTH = 24;

const USAGE = `usage: ${DEFAULT_COMMAND} docs [<topic>]`;

const matching = (pages: readonly Page[], term: string): readonly Page[] => {
  const titled = pages.filter((page) => page.key === term || page.key.endsWith(`/${term}`));
  if (titled.length > 0) return titled;

  const named = pages.filter((page) => page.key.includes(term));
  return named.length > 0 ? named : pages.filter((page) => page.body.includes(term));
};

const listed = (pages: readonly Page[], write: (line: string) => void): void => {
  for (const page of pages) write(`  ${page.key.padEnd(WIDTH)}${page.description}`);
};

export function runDocs({ argv, write }: CommandInput): number {
  const directory = pagesIn(import.meta.dirname, import.meta.filename);
  if (!existsSync(directory)) {
    write("the guides did not ship with this install, so there is nothing to print");
    write(`  looked in ${directory}`);
    return EXIT_ERRORS;
  }

  const [term, ...rest] = argv;
  if (rest.length > 0) {
    write(`unrecognised: ${argv.join(" ")}`);
    write(USAGE);
    return EXIT_BAD_USAGE;
  }

  const pages = allPages(directory);

  if (term === undefined) {
    write(`${DEFAULT_COMMAND} docs <topic> prints one of these pages in full.`);
    write("");
    listed(pages, write);
    return EXIT_CLEAN;
  }

  const [first, ...others] = matching(pages, term);

  if (first === undefined) {
    write(`no page covers ${term}`);
    write("");
    listed(pages, write);
    return EXIT_BAD_USAGE;
  }

  if (others.length > 0) {
    write(`${term} appears on ${others.length + 1} pages, so name one of them:`);
    write("");
    listed([first, ...others], write);
    return EXIT_CLEAN;
  }

  write(`# ${first.title}`);
  write("");
  write(first.body);
  return EXIT_CLEAN;
}

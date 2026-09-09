import type { nameIn } from "../../compose.ts";
import { plural } from "../render.ts";
import { list } from "./lines.ts";

type About = ReturnType<typeof nameIn>;

const priced = (cut: About["cut"]): string =>
  [
    `${plural(cut.travels.length, "declaration")} would travel with it`,
    `${cut.promote.length} would have to be promoted first`,
    `${plural(cut.follows.length, "import")} would follow`,
  ].join(" · ");

const meeting = (directories: readonly string[]): string =>
  directories.length < 2
    ? "            every reader sits in one directory"
    : `            ${directories.length} directories read it, so a split has somewhere to land`;

const readerLines = (readers: About["readers"]): string[] =>
  readers.files.length === 0
    ? ["read by     nothing in this project"]
    : [
        `read by     ${list(readers.files)}`,
        `            zones: ${list(readers.zones)}`,
        `            directories: ${list(readers.directories)}`,
        meeting(readers.directories),
      ];

export interface NameLinesInput {
  readonly about: ReturnType<typeof nameIn>;
  readonly against: readonly string[];
}

export const nameLines = ({ about, against }: NameLinesInput): string[] => {
  const { name, declared, exported, readers, cut } = about;

  if (!declared && !exported) {
    return [`${name} is neither declared nor exported here, so there is nothing to say about it`];
  }

  return [
    `${name}${declared ? "" : "  (exported here, declared elsewhere)"}`,
    "",
    ...readerLines(readers),
    "",
    `cut cost    ${priced(cut)}`,
    `travels     ${list(cut.travels)}`,
    `promote     ${list(cut.promote)}`,
    ...(cut.promote.length === 0
      ? []
      : ["            something that stays reads these, so cutting means promoting them first"]),
    `follows     ${list(cut.follows)}`,
    "",
    `claims      ${against.length === 0 ? "none stand against this name" : `${against.length}`}`,
    ...against.map((said) => `    ${said}`),
    "            delegated tools are not consulted here; run the check itself for those",
  ];
};

import type { nameIn } from "../../compose.ts";
import { plural } from "../render.ts";
import { list } from "./lines.ts";

type About = ReturnType<typeof nameIn>;

const priced = (cut: About["cut"]): string =>
  [
    `${plural(cut.travels.length, "declaration")} would travel with it`,
    `${cut.promote.length} would have to be promoted first`,
    `${plural(cut.follows.length, "import")} would follow`,
    `${cut.importBack.length} here would import it back`,
  ].join(" · ");

const meeting = (readers: About["readers"]): string => {
  if (readers.elsewhere.length === 0) {
    return "            every reader sits in the directory it is declared in";
  }
  if (readers.elsewhere.length === 1) {
    return "            every reader outside that directory sits in one, so a move has one target";
  }
  return `            ${readers.elsewhere.length} directories beyond its own read it, so a split has somewhere to land`;
};

const readerLines = (readers: About["readers"]): string[] =>
  readers.files.length === 0
    ? ["read by     nothing in this project"]
    : [
        `read by     ${list(readers.files)}`,
        `            zones: ${list(readers.zones)}`,
        `            directories: ${list(readers.directories)}`,
        meeting(readers),
      ];

const cutLines = (cut: About["cut"]): string[] => [
  `cut cost    ${priced(cut)}`,
  `travels     ${list(cut.travels)}`,
  `promote     ${list(cut.promote)}`,
  cut.promote.length === 0
    ? "            nothing that stays reads what it reaches, so no one else has to agree"
    : "            something that stays reads these, so cutting means promoting them first",
  `follows     ${list(cut.follows)}`,
  `import back ${list(cut.importBack)}`,
  cut.importBack.length === 0
    ? "            nothing that stays reads it, so the file it leaves needs nothing back"
    : "            these stay and read it, so the cut is not free until they import it back",
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
    ...(declared
      ? cutLines(cut)
      : ["cut cost    not priced here, since what would move is declared in another file"]),
    "",
    `claims      ${against.length === 0 ? "none stand against this name" : `${against.length}`}`,
    ...against.map((said) => `    ${said}`),
    "            delegated tools are not consulted here; run the check itself for those",
  ];
};

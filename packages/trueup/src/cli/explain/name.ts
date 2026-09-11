import type { nameIn } from "../../compose.ts";
import { plural } from "../render.ts";
import { list } from "./lines.ts";

type About = ReturnType<typeof nameIn>;
type Priced = NonNullable<About["cut"]>;

const priced = (cut: Priced): string =>
  [
    `${plural(cut.travels.length, "declaration")} would travel with it`,
    `${cut.promote.length} would have to be promoted first`,
    `${plural(cut.follows.length, "import")} would follow`,
    `${cut.importBack.length} here would import it back`,
  ].join(" · ");

export interface Blocked {
  readonly from: string;
  readonly zones: readonly string[];
}

const meeting = (readers: About["readers"], blocked: Blocked | null): string => {
  if (readers.elsewhere.length === 0) {
    return "            every reader sits in the directory it is declared in";
  }
  if (blocked !== null) {
    return `            ${blocked.from} keeps a reader of this and may not reach ${list(blocked.zones)}`;
  }
  if (readers.elsewhere.length === 1) {
    return "            every reader outside that directory sits in one, so a move has one target";
  }
  return `            ${readers.elsewhere.length} directories beyond its own read it, so a split has somewhere to land`;
};

type ReaderZones = About["readers"]["zones"];

const named = (zones: ReaderZones): readonly string[] =>
  zones.map((zone) => (zone.role === null ? zone.name : `${zone.name} (${zone.role})`));

const roleLines = (zones: ReaderZones, command: string): string[] =>
  zones.some((zone) => zone.role !== null)
    ? [`            a role changes what a claim expects of a zone: ${command} docs zones`]
    : [];

const readerLines = (readers: About["readers"], command: string, blocked: Blocked | null): string[] =>
  readers.files.length === 0
    ? ["read by     nothing in this project"]
    : [
        `read by     ${list(readers.files)}`,
        `            zones: ${list(named(readers.zones))}`,
        ...roleLines(readers.zones, command),
        `            directories: ${list(readers.directories)}`,
        meeting(readers, blocked),
      ];

const landing = (opening: Priced["opening"]): string => {
  if (opening === null) {
    return "            more than one zone reads this, so where it would land is not settled";
  }
  if (opening.length === 0) {
    return "            nothing it imports becomes a finding of its own once it lands";
  }
  return `            once it lands these become findings of their own: ${list(opening)}`;
};

const cutLines = (cut: Priced): string[] => [
  `cut cost    ${priced(cut)}`,
  `travels     ${list(cut.travels)}`,
  `promote     ${list(cut.promote)}`,
  cut.promote.length === 0
    ? "            nothing else in this file reads what it reaches, so no one else has to agree"
    : "            something else in this file reads these, so cutting means promoting them first",
  `follows     ${list(cut.follows)}`,
  ...(cut.follows.length === 0 ? [] : [landing(cut.opening)]),
  `import back ${list(cut.importBack)}`,
  cut.importBack.length === 0
    ? "            nothing else in this file reads it, so the file it leaves needs nothing back"
    : "            these stay in this file and read it, so the cut is not free until they import it back",
];

export interface NameLinesInput {
  readonly about: ReturnType<typeof nameIn>;
  readonly against: readonly string[];
  readonly command: string;
  readonly blocked: Blocked | null;
}

export const nameLines = ({ about, against, command, blocked }: NameLinesInput): string[] => {
  const { name, declared, exported, readers, cut } = about;

  if (!declared && !exported) {
    return [`${name} is neither declared nor exported here, so there is nothing to say about it`];
  }

  return [
    `${name}${declared ? "" : "  (exported here, declared elsewhere)"}`,
    "",
    ...readerLines(readers, command, blocked),
    "",
    ...(cut === null
      ? ["cut cost    not priced here, since what would move is declared in another file"]
      : cutLines(cut)),
    "",
    `claims      ${against.length === 0 ? "none stand against this name" : `${against.length}`}`,
    ...against.map((said) => `    ${said}`),
    "            delegated tools are not consulted here; run the check itself for those",
  ];
};

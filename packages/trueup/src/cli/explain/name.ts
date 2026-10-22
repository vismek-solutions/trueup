import type { nameIn } from "../../main.ts";
import { messageLines } from "../../report/lines.ts";
import { items, listed, tagged } from "../tags.ts";
import { spoken } from "./lines.ts";

type About = ReturnType<typeof nameIn>;
type Priced = NonNullable<About["cut"]>;

const priced = (cut: Priced): string =>
  [
    `travels ${cut.travels.length}`,
    `promote ${cut.promote.length}`,
    `follows ${cut.follows.length}`,
    `import back ${cut.importBack.length}`,
  ].join(", ");

export interface Blocked {
  readonly from: string;
  readonly zones: readonly string[];
}

const meeting = (readers: About["readers"], blocked: Blocked | null): string => {
  if (readers.elsewhere.length === 0) return "every reader sits in the directory it is declared in";
  if (blocked !== null) return `${blocked.from} keeps a reader of this and may not reach ${spoken(blocked.zones)}`;
  if (readers.elsewhere.length === 1) return "every reader outside that directory sits in one, so a move has one target";
  return `${readers.elsewhere.length} directories beyond its own read it, so a split has somewhere to land`;
};

type ReaderZones = About["readers"]["zones"];

const named = (zones: ReaderZones): readonly string[] =>
  zones.map((zone) => (zone.role === null ? zone.name : `${zone.name} (${zone.role})`));

const roleLines = (zones: ReaderZones, command: string): readonly string[] =>
  zones.some((zone) => zone.role !== null) ? [`a role changes what a claim expects of a zone: ${command} docs zones`] : [];

const readerLines = (readers: About["readers"], command: string, blocked: Blocked | null): readonly string[] =>
  readers.files.length === 0
    ? listed("read-by", [])
    : [
        ...listed("read-by", readers.files),
        ...tagged("reader-zones", [...items(named(readers.zones)), ...roleLines(readers.zones, command)]),
        ...tagged("reader-directories", [...items(readers.directories), meeting(readers, blocked)]),
      ];

const landing = (opening: Priced["opening"]): string => {
  if (opening === null) return "more than one zone reads this, so where it would land is not settled";
  if (opening.length === 0) return "nothing it imports becomes a finding of its own once it lands";
  return `once it lands these become findings of their own: ${spoken(opening)}`;
};

const cutLines = (cut: Priced): readonly string[] => [
  ...tagged("cut-cost", priced(cut)),
  ...listed("travels", cut.travels),
  ...tagged("promote", [
    ...items(cut.promote),
    cut.promote.length === 0
      ? "nothing else in this file reads what it reaches, so no one else has to agree"
      : "something else in this file reads these, so cutting means promoting them first",
  ]),
  ...tagged("follows", cut.follows.length === 0 ? "none" : [...items(cut.follows), landing(cut.opening)]),
  ...tagged("import-back", [
    ...items(cut.importBack),
    cut.importBack.length === 0
      ? "nothing else in this file reads it, so the file it leaves needs nothing back"
      : "these stay in this file and read it, so the cut is not free until they import it back",
  ]),
];

const claimLines = (against: readonly string[]): readonly string[] =>
  tagged("claims", [
    ...(against.length === 0
      ? ["none"]
      : against.flatMap((said) => messageLines({ message: said, head: "* ", indent: "  " }))),
    "delegated tools are not consulted here; run the check itself for those",
  ]);

export interface NameLinesInput {
  readonly about: ReturnType<typeof nameIn>;
  readonly against: readonly string[];
  readonly command: string;
  readonly blocked: Blocked | null;
}

export const nameLines = ({ about, against, command, blocked }: NameLinesInput): readonly string[] => {
  const { name, declared, exported, readers, cut } = about;

  if (!declared && !exported) {
    return tagged("not-found", `${name} is neither declared nor exported here, so there is nothing to say about it`);
  }

  return [
    ...(declared ? [] : tagged("declared", "elsewhere, and exported here")),
    ...readerLines(readers, command, blocked),
    ...(cut === null
      ? tagged("cut-cost", "not priced here, since what would move is declared in another file")
      : cutLines(cut)),
    ...claimLines(against),
  ];
};

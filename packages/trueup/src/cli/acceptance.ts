import type { BaselineEntry } from "../ports/baseline.ts";
import type { Acceptance } from "../ratchet/model.ts";
import { messageLines } from "../report/lines.ts";
import { plural } from "./render.ts";

export interface AcceptanceInput extends Acceptance {
  readonly total: number;
  readonly path: string;
}

const entryLines = (entry: BaselineEntry): string[] =>
  messageLines({
    message: entry.message,
    head: entry.file === null ? "    " : `    ${entry.file}  `,
    indent: "        ",
  });

const byClaim = (entries: readonly BaselineEntry[]): Map<string, BaselineEntry[]> => {
  const groups = new Map<string, BaselineEntry[]>();
  for (const entry of entries) groups.set(entry.claim, [...(groups.get(entry.claim) ?? []), entry]);
  return groups;
};

interface RowsInput {
  readonly entries: readonly BaselineEntry[];
  readonly word: string;
  readonly width: number;
  readonly detail: boolean;
}

const rowsFor = ({ entries, word, width, detail }: RowsInput): string[] =>
  [...byClaim(entries)].flatMap(([claim, found]) => [
    `${claim.padEnd(width)}${found.length} ${word}`,
    ...(detail ? found.flatMap(entryLines) : []),
  ]);

export function renderAcceptance({ total, path, added, retired, first }: AcceptanceInput): string {
  const head = `accepted ${plural(total, "finding")} into ${path}`;
  const changed = [...added, ...retired];
  if (changed.length === 0) return `${head} · nothing changed`;

  const width = Math.max(44, ...changed.map((entry) => entry.claim.length + 2));
  const counts = [
    ...(added.length === 0 ? [] : [first ? "the first baseline" : `${added.length} new`]),
    ...(retired.length === 0 ? [] : [`${retired.length} retired`]),
  ];

  return [
    `${head} · ${counts.join(" · ")}`,
    "",
    ...rowsFor({ entries: added, word: "new", width, detail: !first }),
    ...rowsFor({ entries: retired, word: "retired", width, detail: false }),
  ].join("\n");
}

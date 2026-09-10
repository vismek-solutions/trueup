import type { BaselineEntry } from "../ports/baseline.ts";
import type { Acceptance } from "../ratchet/model.ts";
import { plural } from "./render.ts";

export interface AcceptanceInput extends Acceptance {
  readonly total: number;
  readonly path: string;
}

const entryLine = (entry: BaselineEntry): string =>
  entry.file === null ? `    ${entry.message}` : `    ${entry.file}  ${entry.message}`;

const byClaim = (entries: readonly BaselineEntry[]): Map<string, BaselineEntry[]> => {
  const groups = new Map<string, BaselineEntry[]>();
  for (const entry of entries) groups.set(entry.claim, [...(groups.get(entry.claim) ?? []), entry]);
  return groups;
};

export function renderAcceptance({ total, path, added, first }: AcceptanceInput): string {
  const head = `accepted ${plural(total, "finding")} into ${path}`;
  if (added.length === 0) return `${head} · nothing new`;

  const groups = byClaim(added);
  const width = Math.max(44, ...[...groups.keys()].map((claim) => claim.length + 2));

  return [
    `${head} · ${first ? "the first baseline" : `${added.length} new`}`,
    "",
    ...[...groups].flatMap(([claim, entries]) => [
      `${claim.padEnd(width)}${entries.length} new`,
      ...(first ? [] : entries.map(entryLine)),
    ]),
  ].join("\n");
}

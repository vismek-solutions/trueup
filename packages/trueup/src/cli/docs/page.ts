export interface Page {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly claims: readonly string[];
  readonly body: string;
}

const FENCE = "---";

const unquoted = (value: string): string =>
  value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;

const fieldIn = (head: readonly string[], name: string): string => {
  const found = head.find((line) => line.startsWith(`${name}: `));
  return found === undefined ? "" : unquoted(found.slice(name.length + 2).trim());
};

const ITEM = /^\s+-\s+(.+)$/;

const listIn = (head: readonly string[], name: string): readonly string[] => {
  const start = head.indexOf(`${name}:`);
  if (start === -1) return [];

  const items: string[] = [];
  for (const line of head.slice(start + 1)) {
    const item = ITEM.exec(line)?.[1];
    if (item === undefined) break;
    items.push(unquoted(item.trim()));
  }
  return items;
};

export const pageFrom = (key: string, source: string): Page => {
  const lines = source.split("\n");
  const closed = lines[0] === FENCE ? lines.indexOf(FENCE, 1) : -1;
  const head = closed === -1 ? [] : lines.slice(1, closed);

  return {
    key,
    title: fieldIn(head, "title"),
    description: fieldIn(head, "description"),
    claims: listIn(head, "claims"),
    body: lines
      .slice(closed + 1)
      .join("\n")
      .trim(),
  };
};

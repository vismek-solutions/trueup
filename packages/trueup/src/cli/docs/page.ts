export interface Page {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly body: string;
}

const FENCE = "---";

const unquoted = (value: string): string =>
  value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;

const fieldIn = (head: readonly string[], name: string): string => {
  const found = head.find((line) => line.startsWith(`${name}: `));
  return found === undefined ? "" : unquoted(found.slice(name.length + 2).trim());
};

export const pageFrom = (key: string, source: string): Page => {
  const lines = source.split("\n");
  const closed = lines[0] === FENCE ? lines.indexOf(FENCE, 1) : -1;
  const head = closed === -1 ? [] : lines.slice(1, closed);

  return {
    key,
    title: fieldIn(head, "title"),
    description: fieldIn(head, "description"),
    body: lines
      .slice(closed + 1)
      .join("\n")
      .trim(),
  };
};

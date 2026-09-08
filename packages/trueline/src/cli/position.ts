import { readFileSync } from "node:fs";

export interface Position {
  readonly line: number;
  readonly column: number;
}

export type Locate = (file: string, offset: number) => Position | null;

export const locator = (): Locate => {
  const cache = new Map<string, string>();

  return (file, offset) => {
    let text = cache.get(file);
    if (text === undefined) {
      try {
        text = readFileSync(file, "utf8");
      } catch {
        text = "";
      }
      cache.set(file, text);
    }

    if (text === "") return null;

    const upTo = text.slice(0, offset);
    return { line: upTo.split("\n").length, column: offset - (upTo.lastIndexOf("\n") + 1) + 1 };
  };
};

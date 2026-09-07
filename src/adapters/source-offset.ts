import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export type OffsetOf = (path: string, line: number, columnFromZero: number) => number | null;

export function createOffsetReader(root: string): OffsetOf {
  const cache = new Map<string, readonly string[]>();

  return (path, line, columnFromZero) => {
    const absolute = isAbsolute(path) ? path : join(root, path);
    let lines = cache.get(absolute);
    if (lines === undefined) {
      try {
        lines = readFileSync(absolute, "utf8").split("\n");
      } catch {
        lines = [];
      }
      cache.set(absolute, lines);
    }
    if (lines.length === 0 || line < 1) return null;

    let offset = 0;
    for (let index = 0; index < line - 1 && index < lines.length; index += 1) {
      offset += (lines[index]?.length ?? 0) + 1;
    }
    return offset + Math.max(columnFromZero, 0);
  };
}

import { relative } from "node:path";
import picomatch from "picomatch";
import { toPosix } from "../../paths/posix.ts";

export type GroupOf = (file: string) => string | null;

export const groupReader = (root: string, pattern: string): GroupOf => {
  const expression = picomatch.makeRe(`${pattern}/**`, { dot: true, capture: true });

  return (file) => {
    const captured = expression.exec(toPosix(relative(root, file)));
    if (captured === null) return null;

    const segments = captured.slice(1, -1).filter((segment) => segment !== undefined);
    return segments.length === 0 ? null : segments.join("/");
  };
};

export const partReader = (patterns: readonly string[], root: string): ((file: string) => string) => {
  const readers = patterns.map((pattern) => ({ pattern, groupOf: groupReader(root, pattern) }));

  return (file) => {
    for (const { pattern, groupOf } of readers) {
      const group = groupOf(file);
      if (group !== null) return `${pattern}\0${group}`;
    }

    return toPosix(relative(root, file));
  };
};

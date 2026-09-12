import { dirname, sep } from "node:path";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

const GUIDANCE = [
  "A directory holds more files than the limit, which is how a folder stops being one idea and turns into a drawer.",
  "",
  "Do this:",
  "- Group the related files into a subdirectory that names what they share.",
  "- Move out the ones that never belonged here.",
  "",
  "Not the fix: raising the limit. The number exists to force the question of what this directory is for.",
].join("\n");

export interface DirectoryLimit {
  readonly within: string;
  readonly max: number;
}

const limitFor = (directory: string, fallback: number, limits: readonly DirectoryLimit[]): number => {
  const owner = limits
    .filter((limit) => directory === limit.within || directory.startsWith(`${limit.within}${sep}`))
    .sort((left, right) => right.within.length - left.within.length)[0];

  return owner?.max ?? fallback;
};

export function directoryClaim(maxFiles: number, limits: readonly DirectoryLimit[]): Claim {
  return {
    name: "no-directory-holds-too-many-files",
    onePerFile: true,
    check: ({ zones }) => {
      const counts = new Map<string, number>();
      const analysed = [...zones.declaredNames.flatMap((zone) => zones.filesIn(zone)), ...zones.unclassified];

      for (const file of analysed) {
        const directory = dirname(file);
        counts.set(directory, (counts.get(directory) ?? 0) + 1);
      }

      const findings: readonly Finding[] = [...counts]
        .filter(([directory, count]) => count > limitFor(directory, maxFiles, limits))
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .map(([directory, count]) => ({
          severity: "error" as const,
          message: `holds ${count} files, more than the ${limitFor(directory, maxFiles, limits)} allowed`,
          file: directory,
          start: null,
        }));

      return { findings, guidance: GUIDANCE };
    },
  };
}

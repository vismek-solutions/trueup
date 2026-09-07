import { dirname } from "node:path";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

const GUIDANCE =
  "A directory holds more files than the limit, which is how a folder stops being one idea and turns into a drawer. Group the related files into a subdirectory that names what they share, or move out the ones that never belonged. Raising the limit is not the fix: the number exists to force the question of what this directory is for.";

export function directoryClaim(maxFiles: number): Claim {
  return {
    name: "no-directory-holds-too-many-files",
    guidance: GUIDANCE,
    check: ({ zones }): readonly Finding[] => {
      const counts = new Map<string, number>();
      const analysed = [...zones.declaredNames.flatMap((zone) => zones.filesIn(zone)), ...zones.unclassified];

      for (const file of analysed) {
        const directory = dirname(file);
        counts.set(directory, (counts.get(directory) ?? 0) + 1);
      }

      return [...counts]
        .filter(([, count]) => count > maxFiles)
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .map(([directory, count]) => ({
          severity: "error" as const,
          message: `holds ${count} files, more than the ${maxFiles} allowed`,
          file: directory,
          start: null,
        }));
    },
  };
}

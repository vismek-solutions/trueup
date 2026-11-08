import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

export interface ApiSurface {
  readonly manifest: string;
  readonly doors: readonly string[];
  readonly exported: readonly { readonly subpath: string; readonly file: string }[];
  readonly complete: boolean;
}

const GUIDANCE = `A package's \`package.json\` exports and its zones marked \`role: "api"\` have drifted.

Do this:
- Make the two agree.
- Or set \`doorsFromExports\` on the member and remove its api zones in the same edit, so the door is derived.

Not the fix: deleting the api zone alone. That opens the whole package.`;

export function apiSurfaceClaim(surfaces: readonly ApiSurface[]): Claim {
  return {
    name: "every-api-zone-is-exported",
    check: ({ zones, project }) => {
      const analysed = new Set([
        ...zones.declaredNames.flatMap((zone) => zones.filesIn(zone)),
        ...zones.unclassified,
      ]);

      const shut = (door: string, published: ReadonlySet<string>): readonly string[] => {
        const held = zones.filesIn(door);
        if (!held.some((file) => published.has(file))) {
          return [`zone ${door} is a door that package.json does not export`];
        }

        return held
          .filter((file) => !published.has(file))
          .map((file) => `zone ${door} covers ${project.relative(file)}, which package.json does not export`);
      };

      const findings: readonly Finding[] = surfaces.flatMap((surface) => {
        const readable = surface.exported.filter((entry) => analysed.has(entry.file));
        const published = new Set(readable.map((entry) => entry.file));
        const behind = new Set(surface.doors.flatMap((door) => zones.filesIn(door)));

        const uncovered = readable
          .filter((entry) => !behind.has(entry.file))
          .map((entry) => `exports ${entry.subpath}, which no api zone covers`);

        const whole = surface.complete && readable.length === surface.exported.length;
        const unpublished = !whole ? [] : surface.doors.flatMap((door) => shut(door, published));

        return [...uncovered, ...unpublished].map((message) => ({
          severity: "error" as const,
          message,
          file: surface.manifest,
          start: null,
        }));
      });

      return { findings, guidance: GUIDANCE };
    },
  };
}

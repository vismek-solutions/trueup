import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

export interface ApiSurface {
  readonly manifest: string;
  readonly doors: readonly string[];
  readonly exported: readonly { readonly subpath: string; readonly file: string }[];
  readonly complete: boolean;
}

const GUIDANCE =
  'A package states its public surface twice, in `package.json` exports and in the zones marked `role: "api"`, and the two have drifted. A subpath no api zone covers refuses imports that resolve perfectly well; an api zone nothing exports opens a door that no consumer outside this workspace can walk through; and a single file in an api zone that `exports` does not name is reachable by every package invited in, while nobody outside can import it at all. Make them agree, or set `doorsFromExports` on the member so the zone is derived and cannot drift. Deleting the api zone to silence this is not the fix: that opens the whole package.';

export function apiSurfaceClaim(surfaces: readonly ApiSurface[]): Claim {
  return {
    name: "every-api-zone-is-exported",
    guidance: GUIDANCE,
    check: ({ zones, project }): readonly Finding[] => {
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

      return surfaces.flatMap((surface) => {
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
    },
  };
}

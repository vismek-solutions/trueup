import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

export interface ApiSurface {
  readonly manifest: string;
  readonly doors: readonly string[];
  readonly exported: readonly { readonly subpath: string; readonly file: string }[];
  readonly complete: boolean;
}

const GUIDANCE =
  'A package states its public surface twice, in `package.json` exports and in the zones marked `role: "api"`, and the two have drifted. A subpath no api zone covers refuses imports that resolve perfectly well; an api zone nothing exports opens a door that no consumer outside this workspace can walk through. Make them agree, or set `doorsFromExports` on the member so the zone is derived and cannot drift. Deleting the api zone to silence this is not the fix: that opens the whole package.';

export function apiSurfaceClaim(surfaces: readonly ApiSurface[]): Claim {
  return {
    name: "every-api-zone-is-exported",
    guidance: GUIDANCE,
    check: ({ zones }): readonly Finding[] => {
      const analysed = new Set([
        ...zones.declaredNames.flatMap((zone) => zones.filesIn(zone)),
        ...zones.unclassified,
      ]);

      return surfaces.flatMap((surface) => {
        const readable = surface.exported.filter((entry) => analysed.has(entry.file));
        if (readable.length === 0) return [];

        const published = new Set(readable.map((entry) => entry.file));
        const behind = new Set(surface.doors.flatMap((door) => zones.filesIn(door)));

        const uncovered = readable
          .filter((entry) => !behind.has(entry.file))
          .map((entry) => `exports ${entry.subpath}, which no api zone covers`);

        const whole = surface.complete && readable.length === surface.exported.length;
        const unpublished = !whole
          ? []
          : surface.doors
              .filter((door) => !zones.filesIn(door).some((file) => published.has(file)))
              .map((door) => `zone ${door} is a door that package.json does not export`);

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

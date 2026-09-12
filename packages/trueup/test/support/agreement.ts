import { analyze, check, placementOf } from "../../src/compose.ts";
import type { BoundaryRule } from "../../src/claims/boundary.ts";
import { loadConfig, resolveInclude } from "../../src/config/load.ts";
import type { SymbolImportEdge } from "../../src/graph/model.ts";
import { targetPathOf } from "../../src/graph/target.ts";
import type { Report } from "../../src/report/model.ts";
import type { ZoneDefinition } from "../../src/zones/model.ts";
import { assignZones } from "../../src/zones/assign.ts";

const BOUNDARY = "every-import-respects-its-zone-boundary";

type ZoneOf = (file: string) => string | null;

export interface AgreementInput {
  readonly configPath: string;
  readonly breakZone?: string | undefined;
}

export interface Agreement {
  readonly judged: number;
  readonly unzoned: number;
  readonly found: readonly string[];
}

const breachedIn = (report: Report): ReadonlySet<string> =>
  new Set(
    (report.claims.find((claim) => claim.claim === BOUNDARY)?.findings ?? []).map(
      (finding) => `${finding.file}\0${finding.start}`,
    ),
  );

const samplesOf = (files: readonly string[], zoneOf: ZoneOf): ReadonlyMap<string, string> => {
  const sample = new Map<string, string>();
  for (const file of files) {
    const zone = zoneOf(file);
    if (zone !== null && !sample.has(zone)) sample.set(zone, file);
  }
  return sample;
};

interface ReachInput {
  readonly root: string;
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries: readonly BoundaryRule[];
  readonly sample: ReadonlyMap<string, string>;
  readonly breakZone: string | undefined;
}

const reachIndex = ({ root, zones, boundaries, sample, breakZone }: ReachInput): ZoneReach => {
  const cache = new Map<string, ReadonlySet<string>>();

  return (zone) => {
    const known = cache.get(zone);
    if (known !== undefined) return known;

    const path = sample.get(zone);
    const reached = path === undefined ? [] : placementOf({ root, path, zones, boundaries }).mayReach;
    const kept = new Set(breakZone === undefined ? reached : reached.filter((name) => name !== breakZone));

    cache.set(zone, kept);
    return kept;
  };
};

type ZoneReach = (zone: string) => ReadonlySet<string>;

const targetZonesOf = (edge: SymbolImportEdge, zoneOf: ZoneOf): readonly (string | null)[] =>
  [targetPathOf(edge.to), edge.via].filter((path): path is string => path !== null).map(zoneOf);

export async function disagreements({ configPath, breakZone }: AgreementInput): Promise<Agreement> {
  const { config, root, memberConfigs } = await loadConfig(configPath);
  const ignoreFiles = [configPath, ...memberConfigs];
  const roots = resolveInclude(root, config.include);

  const graph = analyze({
    roots,
    extensions: config.extensions,
    externals: config.externals,
    ignoreDirectories: config.ignoreDirectories,
    ignoreFiles,
  });

  const breached = breachedIn(await check({ ...config, root, roots, ignoreFiles }));
  const files = [...graph.files];
  const { zoneOf } = assignZones({ root, files, zones: config.zones });
  const mayReachIn = reachIndex({
    root,
    zones: config.zones,
    boundaries: config.boundaries ?? [],
    sample: samplesOf(files, zoneOf),
    breakZone,
  });

  const found = new Map<string, string>();
  let judged = 0;
  let unzoned = 0;

  for (const edge of graph.edges) {
    const from = breached.has(`${edge.from}\0${edge.start}`) ? null : zoneOf(edge.from);
    if (from === null) continue;

    const targets = targetZonesOf(edge, zoneOf);
    if (targets.length === 0) continue;

    if (targets.includes(null)) {
      unzoned += 1;
      continue;
    }

    judged += 1;
    if (targets.some((zone) => zone !== null && (zone === from || mayReachIn(from).has(zone)))) continue;

    const key = `${from} -> ${targets.join(" | ")}`;
    if (!found.has(key)) found.set(key, edge.from.replace(`${root}/`, ""));
  }

  return { judged, unzoned, found: [...found].map(([pair, example]) => `${pair} (${example})`) };
}

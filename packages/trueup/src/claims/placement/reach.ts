import type { Project, ResolvedImport } from "../../project/model.ts";

type Crossing = ResolvedImport & {
  readonly symbol: string;
  readonly declaredIn: string;
  readonly fromZone: string;
  readonly declaredZone: string;
};

export interface SymbolReach {
  readonly declaredIn: string;
  readonly declaredZone: string;
  readonly symbol: string;
  readonly zones: Set<string>;
  readonly files: Set<string>;
  readonly through: Map<string, Set<string>>;
}

const alsoRead = (reach: SymbolReach, name: string, file: string): void => {
  const files = reach.through.get(name) ?? new Set<string>();
  files.add(file);
  reach.through.set(name, files);
};

const named = (edge: ResolvedImport): edge is Crossing => {
  if (edge.symbol === null || edge.declaredIn === null) return false;
  return edge.fromZone !== null && edge.declaredZone !== null;
};

const usable = (edge: ResolvedImport): edge is Crossing => edge.kind !== "type" && named(edge);

const gather = (imports: readonly ResolvedImport[], keepSameZone: boolean): SymbolReach[] => {
  const seen = new Map<string, SymbolReach>();

  for (const edge of imports) {
    if (!usable(edge)) continue;
    if (!keepSameZone && edge.fromZone === edge.declaredZone) continue;

    const key = `${edge.declaredIn}\0${edge.symbol}`;
    const found = seen.get(key);
    if (found === undefined) {
      seen.set(key, {
        declaredIn: edge.declaredIn,
        declaredZone: edge.declaredZone,
        symbol: edge.symbol,
        zones: new Set([edge.fromZone]),
        files: new Set([edge.from]),
        through: new Map([[edge.symbol, new Set([edge.from])]]),
      });
    } else {
      found.zones.add(edge.fromZone);
      found.files.add(edge.from);
      alsoRead(found, edge.symbol, edge.from);
    }
  }

  return [...seen.values()].sort((left, right) => (left.declaredIn < right.declaredIn ? -1 : 1));
};

const builtFrom = (project: Project): ((file: string, name: string) => readonly string[]) => {
  const cached = new Map<string, readonly string[]>();

  return (file, name) => {
    const key = `${file}\0${name}`;
    const found = cached.get(key);
    if (found !== undefined) return found;

    const reached = project.reachedWithin(file, [name]);
    cached.set(key, reached);

    return reached;
  };
};

const typeOnlyNamesIn = (project: Project, file: string): ReadonlySet<string> => {
  const declarations = project.declarationsIn(file);
  const values = new Set(declarations.filter(({ kind }) => kind === "value").map(({ name }) => name));

  return new Set(declarations.filter(({ name }) => !values.has(name)).map(({ name }) => name));
};

const readsOnlyAType = (project: Project): ((edge: ResolvedImport) => boolean) => {
  const cached = new Map<string, ReadonlySet<string>>();

  return (edge) => {
    if (edge.kind === "type") return true;
    if (edge.declaredIn === null || edge.symbol === null) return false;

    const names = cached.get(edge.declaredIn) ?? typeOnlyNamesIn(project, edge.declaredIn);
    cached.set(edge.declaredIn, names);

    return names.has(edge.symbol);
  };
};

const alsoThroughTypes = (
  project: Project,
  reaches: readonly SymbolReach[],
  isTypeRead: (edge: ResolvedImport) => boolean,
): readonly SymbolReach[] => {
  const standing = new Map(reaches.map((reach) => [`${reach.declaredIn}\0${reach.symbol}`, reach]));
  const namesFrom = builtFrom(project);

  for (const edge of project.imports()) {
    if (!isTypeRead(edge) || !named(edge) || edge.fromZone === edge.declaredZone) continue;

    for (const name of namesFrom(edge.declaredIn, edge.symbol)) {
      const reach = standing.get(`${edge.declaredIn}\0${name}`);
      if (reach === undefined) continue;

      reach.zones.add(edge.fromZone);
      reach.files.add(edge.from);
      alsoRead(reach, edge.symbol, edge.from);
    }
  }

  return reaches;
};

export const acrossZones = (project: Project): readonly SymbolReach[] => {
  const isTypeRead = readsOnlyAType(project);
  const valueReads = project.imports().filter((edge) => !isTypeRead(edge));

  return alsoThroughTypes(project, gather(valueReads, false), isTypeRead);
};

export const everyConsumer = (imports: readonly ResolvedImport[]): SymbolReach[] => gather(imports, true);

export type UnitOf = (declaredIn: string, reader: string) => string;

export const unitsReadingEach = (
  project: Project,
  roles: ReadonlySet<string>,
  unitOf: UnitOf,
): Map<string, Set<string>> => {
  const readers = new Map<string, Set<string>>();

  for (const edge of project.imports()) {
    if (!named(edge) || roles.has(edge.fromZone)) continue;

    const units = readers.get(edge.declaredIn) ?? new Set<string>();
    units.add(unitOf(edge.declaredIn, edge.from));
    readers.set(edge.declaredIn, units);
  }

  return readers;
};

export const alsoReadAtHome = (project: Project): ReadonlySet<string> => {
  const keys = new Set<string>();
  const namesFrom = builtFrom(project);
  const isTypeRead = readsOnlyAType(project);

  for (const edge of project.imports()) {
    if (!named(edge) || edge.fromZone !== edge.declaredZone || edge.from === edge.declaredIn) continue;
    if (!isTypeRead(edge)) keys.add(`${edge.declaredIn}\0${edge.symbol}`);
    for (const name of namesFrom(edge.declaredIn, edge.symbol)) keys.add(`${edge.declaredIn}\0${name}`);
  }

  return keys;
};

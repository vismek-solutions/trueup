export interface ZoneFlow {
  readonly from: string;
  readonly to: string;
  readonly edges: number;
}

export interface Ungoverned {
  readonly unspoken: readonly ZoneFlow[];
  readonly allowed: readonly ZoneFlow[];
  readonly silentZones: readonly string[];
}

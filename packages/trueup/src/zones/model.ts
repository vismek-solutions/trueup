export type ZoneRole = "wiring" | "tests" | "api";

export interface ZoneDefinition {
  readonly name: string;
  readonly patterns: readonly string[];
  readonly role?: ZoneRole | undefined;
  readonly shared?: boolean | undefined;
}

export interface DeadPattern {
  readonly zone: string;
  readonly pattern: string;
}

export interface ZoneAssignment {
  readonly zoneOf: (path: string) => string | null;
  readonly roleOf: (zone: string) => ZoneRole | null;
  readonly declaredNames: readonly string[];
  readonly filesIn: (zone: string) => readonly string[];
  readonly unclassified: readonly string[];
  readonly emptyZones: readonly string[];
  readonly deadPatterns: readonly DeadPattern[];
}

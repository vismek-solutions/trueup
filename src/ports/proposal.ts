export interface Proposal {
  readonly path: string;
  readonly text: string;
}

export interface Decision {
  readonly blocked: boolean;
  readonly reasons: readonly string[];
}

export const ALLOW: Decision = { blocked: false, reasons: [] };

export interface CommandInput {
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly write: (line: string) => void;
}

export const EXIT_CLEAN = 0;
export const EXIT_ERRORS = 1;
export const EXIT_STALE_BASELINE = 2;
export const EXIT_NO_CONFIG = 3;
export const EXIT_BAD_USAGE = 4;
export const EXIT_BAD_RULEBOOK = 5;

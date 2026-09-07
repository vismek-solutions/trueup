export interface CommandInput {
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly write: (line: string) => void;
}

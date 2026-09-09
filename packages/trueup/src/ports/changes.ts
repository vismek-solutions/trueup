export interface FileChange {
  readonly file: string;
  readonly added: number;
  readonly removed: number;
}

export type ChangeSet =
  | { readonly kind: "measured"; readonly base: string; readonly files: readonly FileChange[] }
  | { readonly kind: "unmeasured"; readonly reason: string };

export interface Changes {
  readonly since: (root: string, base: string) => ChangeSet;
}

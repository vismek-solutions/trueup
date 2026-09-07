export interface Proposal {
  readonly path: string;
  readonly text: string;
}

export type HookRequest =
  | { readonly kind: "propose"; readonly proposal: Proposal }
  | { readonly kind: "review"; readonly path: string | null };

export interface Decision {
  readonly blocked: boolean;
  readonly reasons: readonly string[];
}

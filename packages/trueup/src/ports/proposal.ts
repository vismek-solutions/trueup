export interface Proposal {
  readonly path: string;
  readonly text: string;
}

export type HookRequest =
  | { readonly kind: "propose"; readonly proposal: Proposal }
  | { readonly kind: "review"; readonly path: string | null; readonly spread: boolean };

export type Verdict = "allow" | "ask" | "deny";

export interface Decision {
  readonly verdict: Verdict;
  readonly reasons: readonly string[];
}

export type WarrantKind = "testimony" | "search";

export type Warrant = { readonly kind: WarrantKind };

export const warrantKinds: readonly WarrantKind[] = ["testimony", "search"];

export type Resolution =
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "builtin"; readonly name: string }
  | { readonly kind: "external"; readonly name: string }
  | { readonly kind: "unresolved"; readonly reason: string };

export type ResolveSpecifier = (fromFile: string, specifier: string) => Resolution;

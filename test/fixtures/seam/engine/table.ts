type Row = { readonly kind: string; readonly label: string };

export const rowLabel = (row: Row): string => (row.kind === "testimony" ? "Sworn" : row.label);

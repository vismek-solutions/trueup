export const shapeTheWebNames = { kinds: ["one"] };

export type NamedShape = (typeof shapeTheWebNames.kinds)[number];

export const shapeOnlyServerUses = { kinds: ["two"] };

export const alsoOnlyServerUses = { kinds: ["three"] };

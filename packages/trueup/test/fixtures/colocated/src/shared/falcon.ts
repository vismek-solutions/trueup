export const shapeTheWebNames = { kinds: ["one"] };

export type NamedShape = (typeof shapeTheWebNames.kinds)[number];

export const shapeOnlyServerUses = { kinds: ["two"] };

export const alsoOnlyServerUses = { kinds: ["three"] };

export const shapeReachedTwoWays = { kinds: ["four"] };

export type ReachedTwoWays = (typeof shapeReachedTwoWays.kinds)[number];

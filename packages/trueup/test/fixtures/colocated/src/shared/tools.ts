import { forNeighbour } from "./badger.js";
import { usedBySibling } from "./internals.js";

export const forWebOnly = (): string => "web";

export const forBoth = (): string => "both";

export const nearby = (): string => `${usedBySibling()}${forNeighbour()}`;

import alphaDefault, { one, two, uno, beta, type Alpha } from "./index.js";
import * as everything from "./index.js";
import { absent } from "./index.js";

export const used = [alphaDefault, one, two, uno, beta, everything, absent] as const;
export type UsedAlpha = Alpha;

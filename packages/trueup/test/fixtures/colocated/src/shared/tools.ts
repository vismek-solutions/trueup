import { forNeighbour } from "./badger.js";
import { readBothWays } from "./coyote.js";
import { wrapsIt } from "./dingo.js";
import { bothAndHome, wrapsBoth } from "./emu.js";
import { usedBySibling } from "./internals.js";

export const forWebOnly = (): string => "web";

export const forBoth = (): string => "both";

export const nearby = (): string =>
  `${usedBySibling()}${forNeighbour()}${readBothWays()}${wrapsIt()}${wrapsBoth()}${bothAndHome()}`;

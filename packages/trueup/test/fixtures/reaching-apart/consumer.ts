import { disputed, nothing, renamed, split, tangled, viaGhost, viaNowhere } from "./barrel.js";
import { contested } from "./outer.js";

export const used = [disputed, renamed, tangled, nothing, viaGhost, viaNowhere, split, contested] as const;

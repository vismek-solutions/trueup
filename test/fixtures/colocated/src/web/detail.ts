import { usedInProduction } from "../shared/internals.js";
import { forBoth, forWebOnly } from "../shared/tools.js";

export const detail = (): string => `${forWebOnly()}${forBoth()}${usedInProduction()}`;

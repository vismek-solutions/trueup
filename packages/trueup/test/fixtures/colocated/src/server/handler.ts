import { sep } from "node:path";
import * as early from "../shared/aardvark.js";
import {
  alsoOnlyServerUses,
  shapeOnlyServerUses,
  shapeReachedTwoWays,
  shapeTheWebNames,
} from "../shared/falcon.js";
import { wrapsAlone } from "../shared/gecko.js";
import { forBoth } from "../shared/tools.js";

export const handler = (): string =>
  `${forBoth()}${sep}${early.earlyName()}${shapeTheWebNames.kinds}${shapeOnlyServerUses.kinds}${alsoOnlyServerUses.kinds}${shapeReachedTwoWays.kinds}${wrapsAlone()}`;

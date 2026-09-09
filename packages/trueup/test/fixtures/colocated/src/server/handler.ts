import { sep } from "node:path";
import * as early from "../shared/aardvark.js";
import { forBoth } from "../shared/tools.js";

export const handler = (): string => `${forBoth()}${sep}${early.earlyName()}`;

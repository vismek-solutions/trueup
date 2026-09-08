import { sep } from "node:path";
import { forBoth } from "../shared/tools.js";

export const handler = (): string => `${forBoth()}${sep}`;

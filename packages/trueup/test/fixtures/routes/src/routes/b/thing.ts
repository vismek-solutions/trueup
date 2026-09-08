import { sep } from "node:path";
import { rootUtil } from "../root-util.js";

export const thing = `thing${sep}${rootUtil()}`;

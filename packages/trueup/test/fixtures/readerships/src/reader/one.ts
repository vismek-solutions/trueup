import { join } from "node:path";
import { left } from "../api/index.ts";
import { head, middleLink } from "../shared/chain.ts";
import { first } from "../shared/pair.ts";
import { alpha, omega } from "../shared/three-ways.ts";
import { parse } from "../shared/two-jobs.ts";

export const read = join(`${parse("x")}`, `${left}${alpha}${omega}${first}${head}${middleLink}`);

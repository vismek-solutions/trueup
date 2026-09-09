import { dirname } from "node:path";
import { right } from "../api/index.ts";
import { middleLink, tail } from "../shared/chain.ts";
import { second } from "../shared/pair.ts";
import { middle } from "../shared/three-ways.ts";
import { render } from "../shared/two-jobs.ts";
import { ant } from "../shared/unsorted.ts";

export const written = dirname(`${render(1)}${right}${middle}${second}${middleLink}${tail}${ant}`);

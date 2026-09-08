import { hidden } from "../.internal/hidden.js";
import { thing } from "../b/thing.js";
import { util } from "../_shared/util.js";
import { helper } from "./helper.js";

export const page = (): string => thing + util() + helper() + hidden;

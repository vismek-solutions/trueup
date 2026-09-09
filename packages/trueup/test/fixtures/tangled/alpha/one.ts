import { join } from "node:path";
import { two } from "../beta/two.ts";

export const one = (): string => join("one", two);

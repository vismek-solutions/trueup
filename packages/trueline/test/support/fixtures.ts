import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES = fileURLToPath(new URL("../fixtures", import.meta.url));

export const fixtureAt = (name: string): string => join(FIXTURES, name);

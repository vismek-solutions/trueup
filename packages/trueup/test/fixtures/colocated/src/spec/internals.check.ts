import { publishedThing } from "../api/index.js";
import { ONLY_A_TEST_READS_THIS, usedBySibling, usedInProduction } from "../shared/internals.js";
import { specHelper } from "./helpers.js";

export const asserts = (): boolean => usedInProduction() === ONLY_A_TEST_READS_THIS;

export const alsoAsserts = (): string => `${usedBySibling()}${specHelper()}${publishedThing()}`;

import { ONLY_A_TEST_READS_THIS, usedBySibling, usedInProduction } from "../shared/internals.js";

export const asserts = (): boolean => usedInProduction() === ONLY_A_TEST_READS_THIS;

export const alsoAsserts = (): string => usedBySibling();

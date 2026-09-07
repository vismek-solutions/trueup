import { ONLY_A_TEST_READS_THIS, usedInProduction } from "../shared/internals.js";

export const asserts = (): boolean => usedInProduction() === ONLY_A_TEST_READS_THIS;

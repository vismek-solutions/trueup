export const ONLY_A_TEST_READS_THIS = 42;

export const usedInProduction = (): number => ONLY_A_TEST_READS_THIS;

export const usedBySibling = (): string => "sibling";

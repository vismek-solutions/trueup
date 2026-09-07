import type { Warrant } from "../domain/warrant.js";

export const kindOf = (one: Warrant): string => one.kind;

import { ledgerFor } from "./ledger.js";
import { markFor } from "./mark.js";

export const tally = (id: string): string => `${ledgerFor(id)}${markFor(id)}`;

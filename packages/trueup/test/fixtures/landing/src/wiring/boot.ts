import { basketFor } from "../lib/basket.js";
import { ledgerFor } from "../store/ledger.js";
import { markFor } from "../store/mark.js";

export const boot = (id: string): string => `${basketFor(id)}${ledgerFor(id)}${markFor(id)}`;

import { ledgerFor } from "../store/ledger.js";

export const basketFor = (id: string): string => ledgerFor(id);

export const alsoHere = (id: string): string => ledgerFor(id);

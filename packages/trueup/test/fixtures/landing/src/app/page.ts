import { EOL } from "node:os";
import { basketFor } from "../lib/basket.js";
import { cartFor, stays } from "../lib/cart.js";
import { note } from "../lib/note.js";
import { shared } from "../lib/shared.js";
import { stamp } from "../lib/stamp.js";
import * as bag from "../store/bag.js";
import { ledgerFor } from "../store/ledger.js";
import { markFor } from "../store/mark.js";
import { sessionFor, tokenFor } from "../store/session.js";

export const page = (id: string): string =>
  `${cartFor(id)}${stays(id)}${sessionFor(id)}${tokenFor(id)}${shared(id)}` +
  `${basketFor(id)}${ledgerFor(id)}${stamp(id)}${bag.tag}${note(id)}${markFor(id)}${EOL}`;

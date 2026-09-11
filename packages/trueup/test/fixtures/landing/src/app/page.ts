import { cartFor, stays } from "../lib/cart.js";
import { shared } from "../lib/shared.js";
import { sessionFor, tokenFor } from "../store/session.js";

export const page = (id: string): string =>
  `${cartFor(id)}${stays(id)}${sessionFor(id)}${tokenFor(id)}${shared(id)}`;

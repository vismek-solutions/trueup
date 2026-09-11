import { shared } from "../lib/shared.js";
import { markFor } from "../lib/shadow.js";

export const view = (id: string): string => `${shared(id)}${markFor(id)}`;

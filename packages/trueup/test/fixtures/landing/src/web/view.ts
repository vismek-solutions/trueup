import { shared } from "../lib/shared.js";

export const view = (id: string): string => shared(id);

import { tokenFor } from "../store/session.js";

export const other = (id: string): string => tokenFor(id);

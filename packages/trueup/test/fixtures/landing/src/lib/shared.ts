import { tokenFor } from "../store/session.js";

export const shared = (id: string): string => tokenFor(id);

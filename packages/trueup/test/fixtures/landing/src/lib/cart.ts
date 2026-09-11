import { sessionFor, tokenFor } from "../store/session.js";

export const cartFor = (id: string): string => sessionFor(id);

export const stays = (id: string): string => tokenFor(id);

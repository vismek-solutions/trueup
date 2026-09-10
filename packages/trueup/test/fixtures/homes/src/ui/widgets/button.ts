import { fetched } from "../../api/client.js";

export const button = (): string => `[${fetched()}]`;

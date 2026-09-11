import { markFor } from "../store/mark.js";
import { soloFor } from "../store/solo.js";

export const note = (id: string): string => `${markFor(id)}${soloFor(id)}`;

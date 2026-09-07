import { other, type Warrant } from "../shared/index.js";

export const label = (warrant: Warrant): string => `${warrant.kind} ${other}`;

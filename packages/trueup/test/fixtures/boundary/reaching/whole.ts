import * as warrants from "../shared/warrants.js";

export const kinds = (): readonly string[] => [...warrants.warrantKinds];

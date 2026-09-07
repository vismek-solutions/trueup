import { forBoth, forWebOnly } from "../shared/tools.js";

export const detail = (): string => `${forWebOnly()}${forBoth()}`;

import type { OnlyWebNamesThis } from "../shared/kinds.js";
import { forWebOnly } from "../shared/tools.js";

export const list = (item: OnlyWebNamesThis): string => `${item.id}${forWebOnly()}`;

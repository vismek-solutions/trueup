import type { NamedShape } from "../shared/falcon.js";
import type { OnlyWebNamesThis } from "../shared/kinds.js";
import { forWebOnly } from "../shared/tools.js";

export const list = (item: OnlyWebNamesThis, shape: NamedShape): string =>
  `${item.id}${shape}${forWebOnly()}`;

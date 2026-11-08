import type { NamedShape } from "../shared/falcon.js";
import { CompanionWebReads, WebImportsWithoutTheKeyword } from "../shared/kinds.js";
import type { OnlyWebNamesThis } from "../shared/kinds.js";
import { forWebOnly } from "../shared/tools.js";

export const list = (item: OnlyWebNamesThis, shape: NamedShape, plain: WebImportsWithoutTheKeyword): string =>
  `${item.id}${shape}${forWebOnly()}${plain.id}${CompanionWebReads.id}`;

import { alsoEarly, earlyName } from "../shared/aardvark.js";
import { alsoForDetail, forDetail } from "../shared/badger.js";
import { readBothWays } from "../shared/coyote.js";
import { usedInProduction } from "../shared/internals.js";
import { forBoth, forWebOnly } from "../shared/tools.js";

export const detail = (): string =>
  `${forWebOnly()}${forBoth()}${usedInProduction()}${earlyName()}${alsoEarly()}${forDetail()}${alsoForDetail()}${readBothWays()}`;

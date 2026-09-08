import { reachedFromAfar } from "../web/far.ts";
import { strayIn } from "./keys.ts";
import { publishedThing } from "./published.ts";
import { noTestReadsThis } from "./quiet.ts";

export const loadThing = (name: string): string =>
  strayIn(name) || noTestReadsThis(name) > 3 ? publishedThing(name) : reachedFromAfar(name);

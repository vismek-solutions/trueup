import { strayIn } from "../core/keys.ts";
import { loadThing } from "../core/load.ts";
import { publishedThing } from "../core/published.ts";
import { reachedFromAfar } from "../web/far.ts";
import { wiringDetail } from "../wire/detail.ts";

export const checks = [strayIn, loadThing, publishedThing, reachedFromAfar, wiringDetail];

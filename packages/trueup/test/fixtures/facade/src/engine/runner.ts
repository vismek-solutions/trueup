import { join } from "node:path";
import { disputed } from "../domain/both.ts";
import { built } from "../domain/out/built.ts";
import * as everything from "../domain/thing.ts";
import { absent, thing, type Shape } from "../domain/thing.ts";

export const runner = (shape: Shape): string =>
  join(String(thing + shape.a), String(everything.thing), String(absent), String(disputed), built);

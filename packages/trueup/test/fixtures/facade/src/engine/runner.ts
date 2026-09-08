import { join } from "node:path";
import * as everything from "../domain/thing.ts";
import { thing, type Shape } from "../domain/thing.ts";

export const runner = (shape: Shape): string => join(String(thing + shape.a), String(everything.thing));

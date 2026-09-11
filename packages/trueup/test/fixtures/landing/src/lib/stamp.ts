import { EOL } from "node:os";
import * as bag from "../store/bag.js";

export const stamp = (id: string): string => `${bag.tag}${id}${EOL}`;

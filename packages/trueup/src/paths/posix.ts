import { sep } from "node:path";

export const toPosix = (path: string): string => path.split(sep).join("/");

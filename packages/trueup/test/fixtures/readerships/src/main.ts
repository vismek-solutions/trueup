import { parse, render } from "./shared/two-jobs.ts";

export const main = (text: string): string => render(parse(text));

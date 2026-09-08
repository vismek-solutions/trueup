import { stop } from "./run.ts";

export const idle = (): string => stop();
export const wait = (): string => "wait";

import { sep } from "node:path";

const trim = (value: string): string => value.trim();

const clean = (value: string): string => `${trim(value)}${sep}`;

const joinAll = (values: readonly string[]): string => values.map(clean).join(", ");

const shared = (value: string): string => trim(value);

const ping = (steps: number): number => (steps <= 0 ? 0 : pong(steps));

const pong = (steps: number): number => ping(steps - 1);

export const label = (values: readonly string[]): string => joinAll(values);

export const other = (value: string): string => shared(value);

export const bounce = (steps: number): number => ping(steps);

export const seed = "[seed]";

const decorate = (value: string): string => `${seed}${value}`;

export const grown = (value: string): string => decorate(value);

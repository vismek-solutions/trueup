const table: Record<string, number> = { one: 1 };

export const lookUp = (key: string): number => table[key] ?? 0;

export const label = (value: number): string => `#${value}`;

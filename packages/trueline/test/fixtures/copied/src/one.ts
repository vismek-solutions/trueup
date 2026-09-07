export const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");

export const different = (value: string): number => value.length;

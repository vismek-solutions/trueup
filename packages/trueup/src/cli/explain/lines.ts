export const list = (values: readonly string[]): string =>
  values.length === 0 ? "none" : values.join(" · ");

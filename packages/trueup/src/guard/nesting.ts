export const nested = (text: string): string =>
  text
    .split("\n")
    .map((line) => (line === "" ? "" : `  ${line}`))
    .join("\n");

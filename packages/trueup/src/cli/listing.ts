const WIDTH = 24;

export const listed = (entries: Record<string, string>): readonly string[] =>
  Object.entries(entries).map(([name, said]) => `  ${name.padEnd(WIDTH)}${said}`);

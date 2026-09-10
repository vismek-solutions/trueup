import { join } from "node:path";

export const pagesIn = (directory: string, file: string): string => {
  const packageRoot = join(directory, "..", "..", "..");
  return file.endsWith(".ts")
    ? join(packageRoot, "..", "..", "apps", "docs", "src", "content", "docs")
    : join(packageRoot, "dist", "docs");
};

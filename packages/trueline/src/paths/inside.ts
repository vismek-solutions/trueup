import { isAbsolute, relative } from "node:path";

export const inside = (directory: string, path: string): boolean => {
  const step = relative(directory, path);
  return step !== "" && !step.startsWith("..") && !isAbsolute(step);
};

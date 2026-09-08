import type { EdgeTarget } from "./model.ts";

export const targetPathOf = (target: EdgeTarget): string | null => {
  switch (target.kind) {
    case "symbol":
    case "namespace":
    case "missing-export":
    case "external":
      return target.path;
    case "builtin":
    case "ambiguous":
      return null;
  }
};

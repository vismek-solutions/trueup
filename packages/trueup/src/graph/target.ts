import type { EdgeTarget } from "./model.ts";

export const targetPathOf = (target: EdgeTarget): string | null => {
  switch (target.kind) {
    case "symbol":
    case "namespace":
    case "missing-export":
      return target.path;
    case "builtin":
    case "external":
    case "ambiguous":
      return null;
  }
};

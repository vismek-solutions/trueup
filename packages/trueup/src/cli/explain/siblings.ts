import type { siblingsIn } from "../../main.ts";
import { list } from "./lines.ts";

type Placement = ReturnType<typeof siblingsIn>[number];

const said = (placement: Placement): string => {
  if (placement.group === null) {
    return placement.assembles
      ? `assembles \`${placement.siblings}\`, so it may reach every part of it`
      : `sits beside \`${placement.siblings}\` rather than in one of its parts`;
  }
  if (placement.apart.length === 0) {
    return `${placement.group}, one part of \`${placement.siblings}\`, and every other part is shared`;
  }
  return `${placement.group}, which \`${placement.siblings}\` keeps apart from ${list(placement.apart)}`;
};

const alsoShared = (placement: Placement): string[] =>
  placement.shared.length === 0
    ? []
    : [`            it may still reach ${list(placement.shared)}, which the group shares`];

const heldBack = (placement: Placement): string[] =>
  placement.withheld.length === 0
    ? []
    : [
        `            it may not reach ${list(placement.withheld)}, though the group shares ${placement.withheld.length === 1 ? "it" : "them"}`,
      ];

export const siblingLines = (placements: ReturnType<typeof siblingsIn>): string[] =>
  placements.flatMap((placement) => [
    `siblings    ${said(placement)}`,
    ...alsoShared(placement),
    ...heldBack(placement),
  ]);

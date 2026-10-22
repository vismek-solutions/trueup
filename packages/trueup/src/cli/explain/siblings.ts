import type { siblingsIn } from "../../main.ts";
import { listed, tagged } from "../tags.ts";

type Placement = ReturnType<typeof siblingsIn>[number];

const apartSaid = (placement: Placement): string => {
  if (placement.apart.length === 0) return "none";
  const reachable = placement.shared.length === 0 ? "" : ", except the ones in may-reach-shared";
  return `every other part of ${placement.siblings}${reachable}`;
};

const partLines = (placement: Placement): readonly string[] => [
  ...tagged("kept-apart-from", apartSaid(placement)),
  ...(placement.shared.length === 0 ? [] : listed("may-reach-shared", placement.shared)),
  ...(placement.withheld.length === 0 ? [] : listed("may-not-reach-shared", placement.withheld)),
];

const siblingsOf = (placement: Placement): readonly string[] => {
  const group = { group: placement.siblings };
  if (placement.group !== null) return tagged("siblings", partLines(placement), { ...group, part: placement.group });

  return tagged(
    "siblings",
    placement.assembles
      ? "assembles the group, so it may reach every part of it"
      : "sits beside the group rather than in one of its parts",
    group,
  );
};

export const siblingLines = (placements: ReturnType<typeof siblingsIn>): readonly string[] =>
  placements.flatMap(siblingsOf);

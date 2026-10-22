import type { siblingsIn } from "../../main.ts";
import { listed, tagged } from "../tags.ts";

type Placement = ReturnType<typeof siblingsIn>[number];

const partLines = (placement: Placement): readonly string[] => [
  ...listed("kept-apart-from", placement.apart),
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

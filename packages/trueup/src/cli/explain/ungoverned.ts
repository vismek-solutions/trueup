import type { ungovernedIn } from "../../main.ts";
import { items, tagged } from "../tags.ts";

type ZoneFlow = ReturnType<typeof ungovernedIn>["unspoken"][number];

const SHOWN = 20;

const pairOf = (flow: ZoneFlow): string =>
  `${flow.from} → ${flow.to}, ${flow.edges} ${flow.edges === 1 ? "edge" : "edges"}`;

const flowItems = (flows: readonly ZoneFlow[]): readonly string[] => {
  const shown = flows.slice(0, SHOWN).map(pairOf);
  return items(flows.length > SHOWN ? [...shown, `and ${flows.length - SHOWN} more`] : shown);
};

interface Section {
  readonly label: string;
  readonly said: string;
  readonly flows: readonly ZoneFlow[];
}

const headed = ({ label, said, flows }: Section): readonly string[] => [
  ...tagged(label, flows.length === 0 ? "none" : [...flowItems(flows), said]),
  "",
];

export const ungovernedLines = ({
  unspoken,
  allowed,
  silentZones,
}: ReturnType<typeof ungovernedIn>): readonly string[] => [
  ...tagged("about", [
    "Every pair below carries traffic that no boundary rule refuses, so none of it is a violation.",
    "A heavy pair is either the architecture nobody wrote down or a hole nobody noticed, and only",
    "reading it tells you which. Counted by the zone that declares the symbol, not the module named.",
  ]),
  "",
  ...headed({ label: "ungoverned", said: "no rule speaks about these pairs", flows: unspoken }),
  ...headed({ label: "allowed", said: "a rule permits these, so someone decided", flows: allowed }),
  ...tagged(
    "silent",
    silentZones.length === 0
      ? "none"
      : [...items(silentZones), "no boundary rule starts from these, so they may reach anything"],
  ),
];

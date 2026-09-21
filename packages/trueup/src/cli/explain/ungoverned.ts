import type { ungovernedIn } from "../../main.ts";

type ZoneFlow = ReturnType<typeof ungovernedIn>["unspoken"][number];

const SHOWN = 20;

const pairOf = (flow: ZoneFlow): string => `${flow.from} → ${flow.to}`;

const flowLines = (flows: readonly ZoneFlow[], width: number): string[] => {
  const shown = flows.slice(0, SHOWN).map((flow) => `    ${pairOf(flow).padEnd(width)}  ${flow.edges}`);
  return flows.length > SHOWN ? [...shown, `    and ${flows.length - SHOWN} more`] : shown;
};

interface Section {
  readonly label: string;
  readonly said: string;
  readonly flows: readonly ZoneFlow[];
}

const headed = ({ label, said, flows }: Section, width: number): string[] => [
  `${label}  ${flows.length === 0 ? "none" : said}`,
  ...flowLines(flows, width),
  "",
];

export const ungovernedLines = ({
  unspoken,
  allowed,
  silentZones,
}: ReturnType<typeof ungovernedIn>): string[] => {
  const width = Math.max(0, ...[...unspoken, ...allowed].map((flow) => pairOf(flow).length));

  return [
    "Every pair below carries traffic that no boundary rule refuses, so none of it is a violation.",
    "A heavy pair is either the architecture nobody wrote down or a hole nobody noticed, and only",
    "reading it tells you which. Counted by the zone that declares the symbol, not the module named.",
    "",
    ...headed({ label: "ungoverned", said: "no rule speaks about these pairs", flows: unspoken }, width),
    ...headed(
      { label: "allowed   ", said: "a rule permits these, so someone decided", flows: allowed },
      width,
    ),
    `silent      ${silentZones.length === 0 ? "none" : "named by no boundary rule, so they may reach anything"}`,
    ...silentZones.map((zone) => `    ${zone}`),
  ];
};

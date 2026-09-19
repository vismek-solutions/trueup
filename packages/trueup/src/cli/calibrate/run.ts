import { calibrationIn } from "../../main.ts";
import { EXIT_BAD_USAGE, EXIT_CLEAN, type CommandInput } from "../command.ts";
import { openedIn, refusedArguments } from "../preamble.ts";

type Distribution = ReturnType<typeof calibrationIn>[number];
type Point = Distribution["points"][number];

const COLUMN = 30;

const NOTHING_DECLARED = "this rulebook declares no text section, so there is nothing to calibrate";

const CLOSING = [
  "A limit taken from a percentile of your own writing is one you can defend.",
  "No study establishes a length threshold, so a number from a style guide has nothing behind it.",
];

const said = (point: Point): string => `at ${point.value} (${point.label}) ${point.over} over`;

const linesFor = (distribution: Distribution): readonly string[] => {
  const { metric, measured, points } = distribution;
  const configured = points.find((point) => point.label === "configured");
  const candidates = points.filter((point) => point.label !== "configured");

  return [
    "",
    `${metric.padEnd(COLUMN)}${measured} measured`,
    ...(configured === undefined ? [] : [`  ${said(configured)}`]),
    ...(candidates.length === 0 ? [] : [`  ${candidates.map(said).join(" · ")}`]),
  ];
};

export async function runCalibrate({ cwd, argv, write }: CommandInput): Promise<number> {
  if (refusedArguments(argv, "calibrate", write)) return EXIT_BAD_USAGE;

  const opened = await openedIn(cwd, write);
  if (typeof opened === "number") return opened;

  const { config, project } = opened;
  if (config.text === undefined) {
    write(NOTHING_DECLARED);
    return EXIT_CLEAN;
  }

  const distributions = calibrationIn(project, config.text);
  if (distributions.length === 0) {
    write("no markdown matched the files this rulebook names, so nothing was measured");
    return EXIT_CLEAN;
  }

  for (const line of [
    `calibration  ${config.text.files.join(" · ")}`,
    ...distributions.flatMap(linesFor),
    "",
    ...CLOSING,
  ]) {
    write(line);
  }

  return EXIT_CLEAN;
}

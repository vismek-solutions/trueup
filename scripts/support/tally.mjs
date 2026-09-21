import { join } from "node:path";
import { rulingsFor, say } from "./corpus.mjs";

const NOTHING = () => [];

const tallied = ({ ruled, claims, verdicts, extra = NOTHING }) => {
  const [good, bad] = verdicts;

  for (const claim of claims) {
    const mine = ruled.filter((one) => one.claim === claim);
    if (mine.length === 0) continue;

    const right = mine.filter((one) => one.verdict === good).length;
    const wrong = mine.filter((one) => one.verdict === bad);
    const held = mine.length - right - wrong.length;
    const unjudged = held === 0 ? "" : ` · ${held} unjudged`;

    say(`${claim.padEnd(38)}${right} ${good} · ${wrong.length} ${bad} of ${mine.length}${unjudged}`);
    for (const line of extra(claim)) say(`    ${line}`);
    for (const one of wrong.slice(0, 5)) say(`    ${one.file}:${one.line}  ${one.why}`);
  }
};

export const measured = (options) => {
  const ruled = rulingsFor(options);

  say("");
  tallied({ ...options, ruled });
  say(`\nevery verdict, with the line it judged: ${join(options.run, "verdicts.json")}`);
};

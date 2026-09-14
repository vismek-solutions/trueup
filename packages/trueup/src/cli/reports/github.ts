import type { Report, Severity } from "../../report/model.ts";
import { type PlacedFinding, placedIn } from "./placed.ts";

const SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";

const GUIDES = "https://vismek-solutions.github.io/trueup/";

const FINGERPRINT = "trueupFinding/v1";

interface Rule {
  readonly id: string;
  readonly shortDescription: { readonly text: string };
  readonly fullDescription: { readonly text: string };
  readonly help: { readonly text: string };
}

interface Region {
  readonly startLine: number;
  readonly startColumn?: number;
}

interface Result {
  readonly ruleId: string;
  readonly ruleIndex: number;
  readonly level: Severity;
  readonly message: { readonly text: string };
  readonly partialFingerprints: Readonly<Record<string, string>>;
  readonly locations: readonly {
    readonly physicalLocation: {
      readonly artifactLocation: { readonly uri: string };
      readonly region: Region;
    };
  }[];
}

const openingOf = (guidance: string): string => guidance.split("\n\n")[0] ?? guidance;

const ruleOf = (finding: PlacedFinding): Rule => ({
  id: finding.claim,
  shortDescription: { text: openingOf(finding.guidance) },
  fullDescription: { text: finding.guidance },
  help: { text: finding.guidance },
});

const regionOf = (finding: PlacedFinding): Region =>
  finding.column === null
    ? { startLine: finding.line }
    : { startLine: finding.line, startColumn: finding.column };

export function renderGithub(report: Report, root: string, rulebook: string): string {
  const findings = placedIn(report, root, rulebook);
  const rules: Rule[] = [];
  const indexOfRule = new Map<string, number>();

  const results = findings.map((finding): Result => {
    let index = indexOfRule.get(finding.claim);
    if (index === undefined) {
      index = rules.push(ruleOf(finding)) - 1;
      indexOfRule.set(finding.claim, index);
    }

    return {
      ruleId: finding.claim,
      ruleIndex: index,
      level: finding.severity,
      message: { text: finding.message },
      partialFingerprints: { [FINGERPRINT]: finding.fingerprint },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: finding.path },
            region: regionOf(finding),
          },
        },
      ],
    };
  });

  const log = {
    $schema: SCHEMA,
    version: "2.1.0",
    runs: [{ tool: { driver: { name: "trueup", informationUri: GUIDES, rules } }, results }],
  };

  return JSON.stringify(log, null, 2);
}

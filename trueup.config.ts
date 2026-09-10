import { basename, dirname, join, sep } from "node:path";
import { biomeRunner } from "./packages/trueup/src/adapters/biome-runner.ts";
import { FALLOW_CATEGORIES, fallowRunner } from "./packages/trueup/src/adapters/fallow-runner.ts";
import { IGNORED_DIRECTORIES } from "./packages/trueup/src/adapters/node-files.ts";
import { oxlintRunner } from "./packages/trueup/src/adapters/oxlint-runner.ts";
import { defineRule } from "./packages/trueup/src/claims/custom.ts";
import { defineConfig } from "./packages/trueup/src/config/model.ts";
import type { Project } from "./packages/trueup/src/project/model.ts";

const PATHS = ["packages/trueup/src", "packages/trueup/test", "packages/trueup/bin"];

const ASSERTS = new Set(["expect"]);

const DRIVERS = [`packages${sep}trueup${sep}src${sep}compose.ts`];

const UNIT_ZONE = "trueup/spec";

const SUBJECT_GUIDANCE =
  "A unit test asserts on a name declared somewhere other than the file it is named after, or names a file that is not there. After an extraction the first means the code moved and its tests stayed behind, so move the assertions to sit beside the name. Where what it pins is really a composed surface, the test is an integration test: drop the unit suffix and it is judged by none of this. Reaching past the surface to import the subject directly is not a fix, and the internals check refuses it.";

function* outsideStrings(text: string, from: number, to: number): Generator<[string, number]> {
  let quote = "";

  for (let at = from; at < to; at += 1) {
    const char = text[at] ?? "";
    if (quote !== "") {
      if (char === "\\") at += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else yield [char, at];
  }
}

const closingAfter = (text: string, open: number): number => {
  let depth = 0;

  for (const [char, at] of outsideStrings(text, open, text.length)) {
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return at;
    }
  }

  return text.length;
};

const callAfter = (text: string, from: number): number => {
  for (let at = from; at < text.length; at += 1) {
    const char = text[at] ?? "";
    if (char === "(") return at;
    if (!/[\w.$\s]/u.test(char)) return -1;
  }

  return -1;
};

interface Span {
  readonly start: number;
  readonly end: number;
}

const assertionsIn = (project: Project, file: string, text: string): Span[] =>
  project.mentionsIn(file).flatMap((mention) => {
    if (mention.form !== "name" || !ASSERTS.has(mention.text)) return [];
    const open = callAfter(text, mention.start + mention.text.length);
    return open === -1 ? [] : [{ start: open, end: closingAfter(text, open) }];
  });

const nestedIn = (text: string, span: Span, at: number): boolean => {
  let depth = 0;

  for (const [char] of outsideStrings(text, span.start + 1, at)) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
  }

  return depth !== 0;
};

const subjectOf = (file: string): string => {
  const name = basename(file);
  return join(dirname(file).replace(`${sep}test${sep}`, `${sep}src${sep}`), `${name.slice(0, name.indexOf("."))}.ts`);
};

const declaredByIn = (project: Project, file: string): Map<string, string> =>
  new Map(
    project
      .imports()
      .flatMap((edge) =>
        edge.from === file && edge.declaredIn !== null ? [[edge.local, edge.declaredIn] as const] : [],
      ),
  );

const strangeNamesIn = (project: Project, file: string, subject: string) => {
  const text = project.sourceOf(file);
  if (text === null) return [];

  const spans = assertionsIn(project, file, text);
  const declaredBy = declaredByIn(project, file);
  const said = new Set<string>();

  return project.mentionsIn(file).flatMap((mention) => {
    const declaredIn = declaredBy.get(mention.text);
    if (mention.form !== "name" || declaredIn === undefined || declaredIn === subject) return [];
    if (declaredIn.includes(`${sep}test${sep}`) || DRIVERS.some((path) => declaredIn.endsWith(path))) return [];

    const holder = spans.find((span) => mention.start > span.start && mention.start < span.end);
    if (holder === undefined || nestedIn(text, holder, mention.start) || said.has(mention.text)) return [];
    said.add(mention.text);

    return [
      {
        severity: "warning" as const,
        message: `asserts on ${mention.text}, declared in ${project.relative(declaredIn)} rather than in ${project.relative(subject)}`,
        file,
        at: mention.start,
      },
    ];
  });
};

const testSubjectRule = defineRule(
  "no-test-asserts-on-a-name-it-does-not-own",
  (project) => {
    const sources = new Set(project.files);

    return project.files
      .filter((file) => project.zoneOf(file) === UNIT_ZONE)
      .flatMap((file) => {
        const subject = subjectOf(file);
        if (sources.has(subject)) return strangeNamesIn(project, file, subject);

        return [
          {
            severity: "warning" as const,
            message: `is a unit test, and no source file answers to ${project.relative(subject)}`,
            file,
          },
        ];
      });
  },
  SUBJECT_GUIDANCE,
);

export default defineConfig({
  members: ["packages/*"],
  zones: [{ name: "docs", patterns: ["apps/docs/**"] }],
  boundaries: [{ from: "docs", allow: [] }],
  externals: ["astro:*"],
  ignoreDirectories: [...IGNORED_DIRECTORIES, "fixtures", ".astro", ".stryker-tmp"],
  command: "node ./packages/trueup/bin/trueup.js",
  protect: ["CLAUDE.md", ".claude/settings.json"],
  maxFilesPerDirectory: 12,
  duplication: 60,
  readerships: true,
  colocation: true,
  testInternals: true,
  rules: [testSubjectRule],
  runners: [
    biomeRunner({
      command: ["node_modules/.bin/biome", "lint"],
      paths: PATHS,
      write: process.env.CI === undefined,
    }),
    fallowRunner({
      command: ["node_modules/.bin/fallow"],
      categories: [...FALLOW_CATEGORIES],
      duplication: { mode: "weak", minLines: 5, minTokens: 30 },
    }),
    oxlintRunner({
      command: ["node_modules/.bin/oxlint"],
      paths: PATHS,
      categories: ["eslint/max-params"],
      write: process.env.CI === undefined,
    }),
  ],
});

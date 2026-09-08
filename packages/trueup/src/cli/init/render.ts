import type { ZoneLine } from "./zones.ts";

interface RunnerRecipe {
  readonly dependency: string;
  readonly call: string;
  readonly scope?: "paths" | "patterns";
  readonly fixed?: string;
}

const RUNNERS: readonly RunnerRecipe[] = [
  { dependency: "@biomejs/biome", call: "biomeRunner", scope: "paths", fixed: 'categories: ["lint"]' },
  { dependency: "eslint", call: "eslintRunner", scope: "patterns" },
  { dependency: "fallow", call: "fallowRunner" },
  { dependency: "oxlint", call: "oxlintRunner", scope: "paths" },
];

const callOf = ({ call, scope, fixed }: RunnerRecipe, scoped: readonly string[]): string => {
  const options = [
    ...(fixed === undefined ? [] : [fixed]),
    ...(scope === undefined || scoped.length === 0 ? [] : [`${scope}: [${list(scoped)}]`]),
  ];
  return options.length === 0 ? `${call}()` : `${call}({ ${options.join(", ")} })`;
};

export const runnersFor = (dependencies: readonly string[], scoped: readonly string[]): readonly string[] =>
  RUNNERS.filter((recipe) => dependencies.includes(recipe.dependency)).map((recipe) =>
    callOf(recipe, scoped),
  );

export const runnerName = (call: string): string => call.slice(0, call.indexOf("("));

const block = (key: string, entries: readonly string[]): readonly string[] =>
  entries.length === 0 ? [] : [`  ${key}: [`, ...entries.map((entry) => `    ${entry},`), "  ],"];

const list = (values: readonly string[]): string => values.map((value) => `"${value}"`).join(", ");

const file = (imported: readonly string[], body: readonly string[], define: string): string =>
  [
    `import { ${imported.join(", ")} } from "trueup";`,
    "",
    `export default ${define}({`,
    ...body,
    "});",
    "",
  ].join("\n");

export interface RootInput {
  readonly members: readonly string[];
  readonly zones: readonly ZoneLine[];
  readonly runners: readonly string[];
}

export const renderRoot = ({ members, zones, runners }: RootInput): string =>
  file(
    ["defineConfig", ...runners.map(runnerName)],
    [
      ...(members.length === 0 ? [] : [`  members: [${list(members)}],`]),
      ...block(
        "zones",
        zones.map((zone) => zone.declaration),
      ),
      ...block("runners", runners),
    ],
    "defineConfig",
  );

export const renderMember = (zones: readonly ZoneLine[], allow: readonly string[]): string =>
  file(
    ["defineMember"],
    [
      ...(allow.length === 0 ? [] : [`  allow: [${list(allow)}],`]),
      ...block(
        "zones",
        zones.map((zone) => zone.declaration),
      ),
    ],
    "defineMember",
  );

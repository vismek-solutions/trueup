import type { ResolvedConfig } from "../../config/model.ts";
import { pathsIn, rulebookGuarded } from "../../guard/protected.ts";
import { plural } from "../render.ts";
import { items, tagged } from "../tags.ts";

type Body = string | readonly string[];

const itemsOf = (values: readonly string[] | undefined): Body | undefined =>
  values === undefined || values.length === 0 ? undefined : items(values);

const counted = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

type Budget = NonNullable<ResolvedConfig["reviewable"]>;

const budgetSaid = (budget: Budget | undefined): string | undefined => {
  if (budget === undefined) return undefined;
  const band = budget.nearing === undefined ? "" : `, warning from ${budget.nearing * 100}%`;
  const bite = budget.severity === "error" ? "fails" : "warns";

  return `+${budget.additions} / -${budget.deletions} against ${budget.base ?? "main"}, ${bite} past it${band}`;
};

const switched = (value: boolean | undefined): string | undefined => {
  if (value === undefined) return undefined;
  return value ? "on" : "off";
};

type Prose = NonNullable<ResolvedConfig["text"]>;

const limited = (max: number | undefined, noun: string, per: string): string | null =>
  max === undefined ? null : `${plural(max, noun)} ${per}`;

const proseSaid = (text: Prose | undefined): Body | undefined => {
  if (text === undefined) return undefined;

  const held = [
    text.marks === undefined ? null : "marks",
    text.words === undefined ? null : "words",
    limited(text.maxSentenceWords, "word", "a sentence"),
    limited(text.maxParagraphSentences, "sentence", "a paragraph"),
    limited(text.maxInlineCodeWords, "word", "of inline code"),
    text.links === true ? "link text" : null,
    limited(text.maxSectionWordsWithoutExample, "word", "a section without an example"),
  ].filter((name) => name !== null);

  const read = [
    ...text.files,
    ...(text.comments === true ? ["every comment"] : []),
    ...(text.strings ?? []).map((pattern) => `the prose in ${pattern}`),
  ];
  return held.length === 0 ? undefined : [...tagged("reads", items(read)), ...tagged("holds", items(held))];
};

export const settingLines = (config: ResolvedConfig, read: number): readonly string[] => {
  const values: readonly (readonly [string, Body | undefined])[] = [
    ["files-read", String(read)],
    ["members", itemsOf(config.members)],
    ["roots", itemsOf(config.include)],
    ["extensions", itemsOf(config.extensions)],
    ["externals", itemsOf(config.externals)],
    ["ignored-directories", itemsOf(config.ignoreDirectories)],
    ["max-files-per-directory", counted(config.maxFilesPerDirectory)],
    [
      "duplication",
      config.duplication === undefined ? undefined : `declarations from ${config.duplication} characters`,
    ],
    ["reviewable", budgetSaid(config.reviewable)],
    ["colocation", switched(config.colocation)],
    ["readerships", switched(config.readerships)],
    ["test-internals", switched(config.testInternals)],
    ["prose", proseSaid(config.text)],
    [
      "rulebook",
      rulebookGuarded(config.protect)
        ? "guarded, so an edit to it is ruled on"
        : "unguarded, so an agent may edit it and switch off any check it fails",
    ],
    ["also-protected", itemsOf(pathsIn(config.protect))],
    ["deferred-at-write", itemsOf(config.deferAtWrite)],
    ["also-runs", itemsOf(config.runners?.map((runner) => runner.name))],
    ["custom-rules", itemsOf(config.rules.map((rule) => rule.name))],
  ];

  return values.flatMap(([name, body]) => (body === undefined ? [] : tagged(name, body)));
};

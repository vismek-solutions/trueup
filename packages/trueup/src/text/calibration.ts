import type { Project } from "../project/model.ts";
import type { TextSettings } from "./claims.ts";
import { documentsIn } from "./documents.ts";
import { proseSpanWords } from "./inline.ts";
import { paragraphSentences, sentenceWords } from "./limits.ts";
import type { Measure, Passage } from "./model.ts";

export interface Point {
  readonly label: string;
  readonly value: number;
  readonly over: number;
}

export interface Distribution {
  readonly metric: string;
  readonly measured: number;
  readonly points: readonly Point[];
}

const PERCENTILES = [
  ["p90", 0.9],
  ["p95", 0.95],
  ["p99", 0.99],
  ["max", 1],
] as const;

const percentile = (sorted: readonly number[], fraction: number): number =>
  sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)] ?? 0;

const overCount = (sorted: readonly number[], limit: number): number =>
  sorted.filter((value) => value > limit).length;

const distributionOf = (
  metric: string,
  measures: readonly Measure[],
  configured: number | undefined,
): Distribution | null => {
  if (measures.length === 0 && configured === undefined) return null;
  if (measures.length === 0) return { metric, measured: 0, points: [] };

  const sorted = measures.map((measure) => measure.value).sort((left, right) => left - right);
  const named: readonly (readonly [string, number])[] = [
    ...(configured === undefined ? [] : ([["configured", configured]] as const)),
    ...PERCENTILES.map(([label, fraction]) => [label, percentile(sorted, fraction)] as const),
  ];

  return {
    metric,
    measured: sorted.length,
    points: named.map(([label, value]) => ({ label, value, over: overCount(sorted, value) })),
  };
};

const calibrationOf = (
  passages: readonly Passage[],
  settings: TextSettings,
): readonly Distribution[] =>
  [
    distributionOf("sentence words", sentenceWords(passages), settings.maxSentenceWords),
    distributionOf("paragraph sentences", paragraphSentences(passages), settings.maxParagraphSentences),
    distributionOf("inline code words", proseSpanWords(passages), settings.maxInlineCodeWords),
  ].filter((entry) => entry !== null);

export const distributionsIn = (
  project: Project,
  settings: TextSettings,
): readonly Distribution[] =>
  calibrationOf(
    documentsIn(project, settings.files).flatMap((document) => document.passages),
    settings,
  );

import picomatch from "picomatch";

export interface SharedSibling {
  readonly shared: string;
  readonly allow: readonly string[];
}

export type SiblingException = string | SharedSibling;

export type Matches = (group: string) => boolean;

const matching = (patterns: readonly string[]): Matches =>
  patterns.length === 0 ? () => false : picomatch([...patterns], { dot: true });

const patternOf = (exception: SiblingException): string =>
  typeof exception === "string" ? exception : exception.shared;

export interface Sharing {
  readonly shares: Matches;
  readonly withheld: (from: string, to: string) => readonly string[] | null;
}

export const sharingOf = (exceptions: readonly SiblingException[] | undefined): Sharing => {
  const entries = (exceptions ?? []).map((exception) => ({
    matches: matching([patternOf(exception)]),
    allow: typeof exception === "string" ? null : exception.allow,
    permits: typeof exception === "string" ? () => true : matching(exception.allow),
  }));

  return {
    shares: matching((exceptions ?? []).map(patternOf)),
    withheld: (from, to) => {
      const entry = entries.find(({ matches }) => matches(from));
      return entry === undefined || entry.allow === null || entry.permits(to) ? null : entry.allow;
    },
  };
};

export const reachWording = (allow: readonly string[]): string =>
  allow.length === 0
    ? "shared with no reach into what else is shared"
    : `shared with reach into ${allow.map((pattern) => `\`${pattern}\``).join(" · ")} only`;

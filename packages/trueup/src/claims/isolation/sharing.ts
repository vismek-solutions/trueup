import picomatch from "picomatch";

export interface SharedSibling {
  readonly shared: string;
  readonly allow: readonly string[];
}

export type SiblingException = string | SharedSibling;

export type Matches = (group: string) => boolean;

const matching = (patterns: readonly string[]): Matches => picomatch([...patterns], { dot: true });

const patternOf = (exception: SiblingException): string =>
  typeof exception === "string" ? exception : exception.shared;

interface Reach {
  readonly allow: readonly string[];
  readonly permits: Matches;
}

const reachOf = (exception: SiblingException): Reach | null =>
  typeof exception === "string" ? null : { allow: exception.allow, permits: matching(exception.allow) };

export interface Sharing {
  readonly shares: Matches;
  readonly withheld: (from: string, to: string) => readonly string[] | null;
}

export const sharingOf = (exceptions: readonly SiblingException[] | undefined): Sharing => {
  const listed = exceptions ?? [];
  const entries = listed.map((exception) => ({ matches: matching([patternOf(exception)]), reach: reachOf(exception) }));

  return {
    shares: matching(listed.map(patternOf)),
    withheld: (from, to) => {
      const reach = entries.find(({ matches }) => matches(from))?.reach ?? null;
      return reach === null || reach.permits(to) ? null : reach.allow;
    },
  };
};

export const reachWording = (allow: readonly string[]): string =>
  allow.length === 0
    ? "shared with no reach into what else is shared"
    : `shared with reach into ${allow.map((pattern) => `\`${pattern}\``).join(" · ")} only`;

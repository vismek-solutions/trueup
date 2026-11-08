const OPENING = "A zone exports a value that only one other zone uses, so it is that consumer's code in the wrong place.";

const BRANCH = {
  wholeFile:
    "`... so the file is in the wrong directory ...`: that consumer is the file's only counted reader. Move the file into it and every finding on it closes.",
  oneName: "`declares <name>, used only by ...`: move that declaration into the consumer.",
  homeReads:
    "`declares <name>, used outside its zone only by ...`: the declaring zone reads it too. Check what that zone may reach before moving it, and prefer dissolving the value into the outside consumer.",
  neighbour:
    "`... and by this file as well`: another declaration here reads it. Move that declaration with it, or leave both where they are. If the zone reaches it through that neighbour, moving the pair leaves the zone crossing the boundary.",
  partwise:
    "The consumer named is a directory or a file, because the declaring zone is `shared`. Move the declaration into that part. A second part reading it would close this.",
  typeReaders:
    "A list under the finding names what each reader imports, shown when one reaches the value through a type built from it. That reader pins the value where it is.",
  silenced:
    "`while <zone> reads it too but is <role>, so it does not count`: that reader's role silences it. Move the value into the consumer named, or give the logic that reader owns a home in a zone that counts, which makes it a second reader. Moving the value anywhere else closes nothing.",
} as const;

export type PlacementShape = keyof typeof BRANCH;

const ORDER = Object.keys(BRANCH) as readonly PlacementShape[];

const ASK_FIRST =
  "First ask whether the seam should carry it at all. A value the caller derives from an argument it hands the same collaborator belongs to that collaborator.";

const SHARED_HOME =
  "A new zone for the value closes this only when two zones then read it. Use one anyway when the consumer must not own the value, such as a test harness or a downstream app, and accept the finding that stands.";

const NOT_THE_FIX = `Not the fix:
- Giving a zone a role so it stops counting as a consumer. A role is honest only for a zone that never owns what it uses.
- Leaving it because a second consumer may arrive later.
- Declaring a zone \`shared\` so its count falls to parts of the consumer. That is honest only for a layer written to serve the layer above it.`;

export const placementGuidance = (shapes: ReadonlySet<PlacementShape>): string => {
  const bullets = ORDER.filter((shape) => shapes.has(shape)).map((shape) => `- ${BRANCH[shape]}`);
  const reading = bullets.length === 0 ? [] : ["", "The finding's shape decides what moves:", ...bullets];

  return [OPENING, ...reading, "", ASK_FIRST, "", SHARED_HOME, "", NOT_THE_FIX].join("\n");
};

export const INTERNALS = `A test reaches a symbol nothing outside its own directory calls, so the test is bound to an implementation detail.

Do this:
- Reach the behaviour through the surface production callers use.
- If that is too expensive, let the symbol become a module with a caller of its own.

Not the fix:
- Widening the surface so the direct test becomes legitimate.
- Adding a production caller to justify it.

A zone with the \`wiring\` role is not reported. Something the package publishes belongs in a zone with the \`api\` role.`;

export const NO_TESTS = `No zone has the \`tests\` role, so this check has nothing to judge.

Do this:
- Give the zone holding the tests the \`tests\` role.`;

export const FOR_TESTS = `Only tests use this export.

Do this:
- Reach the behaviour through the surface production calls, and make the export private.
- If the piece deserves its own test, make it its own module with a real caller.
- Move a helper that exists only for tests into a zone with the \`tests\` role.
- Put something a package publishes in a zone with the \`api\` role.

Not the fix: adding a production caller so the export has a consumer.`;

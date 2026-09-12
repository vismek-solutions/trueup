const OPENING =
  "A zone exports a value that only one other zone uses, so the seam it crosses carries nothing a second caller needs. A symbol in a shared package that one consumer uses is not shared, it is that consumer's code in the wrong place.";

const BRANCH = {
  wholeFile:
    "`declares N exports, all used only by ...` means nothing outside that one consumer reads the file at all, its own zone included. Move the file into that consumer and every finding on it closes at once.",
  oneName:
    "`declares <name>, used only by ...` means the rest of the file has other readers, so the file stays and only that declaration is in question.",
  homeReads:
    "`declares <name>, used outside its zone only by ...` means the declaring zone reads it too. Moving it leaves that reader crossing a boundary, so check what the declaring zone may reach before you move anything, and prefer dissolving the value into its one outside consumer.",
  neighbour:
    "`... and by this file as well` means another declaration here reads it, so the file it leaves would have to import it back. Move that declaration with it, or leave both where they are. The zone may be reading it through that neighbour, in which case moving the pair leaves the zone crossing the boundary for the neighbour instead.",
  typeReaders:
    "A list under the finding names what each reader imports, and appears when one of them reaches the value through a type built from it. Such a reader pins the value where it is as firmly as one that names it, so the list is there to be checked rather than argued with.",
  silenced:
    "`while <zone> reads it too but is <role>, so it does not count` means the reader that would have made this a shared value is silenced by its role. Moving the declaration anywhere but into the consumer named closes nothing, because that reader will not count wherever it sits. So either the role is wrong, and the logic that reader owns belongs in a zone that counts, or the value belongs to the consumer named. A wiring zone holding a loop of its own is the usual cause: give that loop a home outside the composition root and it becomes a second reader, and that is the one move here that does close the finding.",
} as const;

export type PlacementShape = keyof typeof BRANCH;

const ORDER = Object.keys(BRANCH) as readonly PlacementShape[];

const ASK_FIRST =
  "Before moving a single declaration, ask whether the seam should carry it at all. A value the caller derives from an argument it hands the same collaborator belongs to that collaborator, which can derive it itself and leave the two nothing to disagree about. Moving it is the fix only when it does not.";

const SHARED_HOME =
  "Giving the value a zone of its own, or a package underneath the ones that read it, closes nothing by itself, because the count is about who reads it rather than where it sits. Reach for the shared home anyway when the consumer named must not own the value, a test harness or a downstream app for instance, and accept the finding that stands after it.";

const NOT_THE_FIX = [
  "Not the fix:",
  "- Giving a zone a role so it stops counting as a consumer. A role is honest only for a zone that never owns what it uses.",
  "- Leaving it because a second consumer may arrive later. That is a reason to move it back then, not a reason to leave it now.",
].join("\n");

const WHY_NO_TYPES =
  "A type is never reported, because a type can be used through a value without ever being imported, so counting its readers would name one consumer where there are several. A zone that imports a type does count as a consumer of the values that type is built from, because the type cannot be declared anywhere those values are not, so that zone pins them where they are.";

export const placementGuidance = (shapes: ReadonlySet<PlacementShape>): string => {
  const bullets = ORDER.filter((shape) => shapes.has(shape)).map((shape) => `- ${BRANCH[shape]}`);
  const reading =
    bullets.length === 0
      ? []
      : ["", "The shape of the finding decides what moves, so do not work it out again from the file:", ...bullets];

  return [
    OPENING,
    ...reading,
    "",
    ASK_FIRST,
    "",
    SHARED_HOME,
    "",
    NOT_THE_FIX,
    ...(shapes.has("typeReaders") ? ["", WHY_NO_TYPES] : []),
  ].join("\n");
};

export const INTERNALS = [
  "A test reaches a symbol that nothing outside its own directory calls, so the test knows a decomposition none of the callers know. Fold that symbol into the neighbour that uses it and the behaviour is unchanged while the test breaks, which is what it means for a test to be bound to an implementation detail rather than to behaviour.",
  "",
  "Do this:",
  "- Reach the behaviour through the surface the production callers already go through, and the split underneath is free to move.",
  "- When that is genuinely too expensive, because a handful of cases each need their own fixture to drive from outside, let the symbol become a module with a caller of its own.",
  "",
  "Not the fix:",
  "- Widening the surface so the direct test becomes legitimate.",
  "- Adding a production caller to justify it.",
  "",
  "Both leave the codebase worse than the finding did. A zone with the `wiring` role is not reported, because a composition root has no internals to protect, and something the package publishes belongs in a zone with the `api` role.",
].join("\n");

export const FOR_TESTS = [
  "Nothing outside the tests uses this export, so it is public only so a test can reach in.",
  "",
  "Do this:",
  "- Reach the behaviour through the surface production actually calls, and the export can go back to being private.",
  "- If the piece genuinely deserves its own test, let it become its own module with a real caller rather than a widened surface on this one.",
  "- A helper that exists purely to serve tests belongs in a zone with the `tests` role, not in the source it props up.",
  "",
  "Something a package publishes belongs in a zone with the `api` role, whose consumers this analysis cannot see.",
  "",
  "Not the fix: adding a production caller so the export has a real consumer. That is the one change that leaves the codebase worse than the finding did.",
].join("\n");

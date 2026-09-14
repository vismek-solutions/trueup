import type { RefusalNotes } from "../claims/boundary.ts";
import { doorsOf, namesOf, type Member } from "./members.ts";

const listed = (names: readonly string[]): string =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export const doorNotes = (members: readonly Member[]): RefusalNotes => {
  const owners = new Map(
    members.flatMap((member) => namesOf(member).map((zone) => [zone, member] as const)),
  );

  return (refused) => {
    const closed = new Map<Member, Set<string>>();

    for (const { from, to } of refused) {
      const owner = owners.get(to);
      if (owner === undefined || owner === owners.get(from) || doorsOf(owner).includes(to)) continue;
      closed.set(owner, (closed.get(owner) ?? new Set<string>()).add(to));
    }

    return [...closed].map(
      ([owner, zones]) =>
        `${owner.name} has an api zone, so every other package reaches it through ${listed(doorsOf(owner))} and nowhere else. That closes ${listed([...zones].sort())}.`,
    );
  };
};

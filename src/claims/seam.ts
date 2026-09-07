import { relative } from "node:path";
import type { Claim } from "./model.ts";
import type { ZoneReference } from "./zone-references.ts";

export interface SeamRule {
  readonly generic: string;
  readonly domain: readonly string[];
  readonly allow?: readonly string[] | undefined;
  readonly minLiteralLength?: number | undefined;
}

const DEFAULT_MIN_LITERAL_LENGTH = 4;

export const seamZoneReferences = (rules: readonly SeamRule[]): readonly ZoneReference[] =>
  rules.flatMap((rule) =>
    [rule.generic, ...rule.domain].map((zone) => ({ rule: `seam rule for ${rule.generic}`, zone })),
  );

export function seamClaim(rules: readonly SeamRule[]): Claim {
  return {
    name: "generic-code-names-no-domain-concept",
    guidance:
      "Generic code named a symbol the domain exports, or repeated a value the domain declares, with no import to explain it. This is the violation that crosses no import edge: a value arrives as a prop and the receiving file restates a shape it may not know. Take the name or value from the domain rather than restating it, or move the code into a zone that may know the domain. Run `acs explain <file>` to see the vocabulary. Add to `allow` only for a word the two genuinely share.",
    check: ({ root, zones, lexicon }) =>
      rules.flatMap((rule) => {
        const vocabulary = lexicon.vocabularyOf(rule.domain.flatMap((zone) => zones.filesIn(zone)));
        const allowed = new Set(rule.allow ?? []);
        const minimum = rule.minLiteralLength ?? DEFAULT_MIN_LITERAL_LENGTH;

        return zones.filesIn(rule.generic).flatMap((file) => {
          const imported = lexicon.importedNamesIn(file);
          const reported = new Set<string>();

          return lexicon.mentionsIn(file).flatMap((mention) => {
            if (allowed.has(mention.text) || reported.has(mention.text)) return [];

            const leaks =
              mention.form === "name"
                ? vocabulary.names.has(mention.text) && !imported.has(mention.text)
                : mention.text.length >= minimum && vocabulary.literals.has(mention.text);
            if (!leaks) return [];

            reported.add(mention.text);
            const what = mention.form === "name" ? `the name ${mention.text}` : `the value "${mention.text}"`;
            return [
              {
                severity: "error" as const,
                message: `${relative(root, file)} is ${rule.generic} and names ${what}, which ${rule.domain.join(" or ")} owns`,
                file,
                start: mention.start,
              },
            ];
          });
        });
      }),
  };
}

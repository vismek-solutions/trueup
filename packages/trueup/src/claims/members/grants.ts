import type { Claim } from "../model.ts";

export interface MemberGrants {
  readonly configPath: string;
  readonly dependsOn: readonly string[];
  readonly grants: readonly { readonly member: string; readonly dependency: string }[];
}

const GUIDANCE = `A member's \`allow\` names a package its \`package.json\` does not depend on.

Do this:
- Drop the name from \`allow\`.
- Or declare the dependency, if the package really is used.

Not the fix:
- Declaring a dependency nothing imports.
- Keeping the grant for an import you plan to write.`;

export function grantClaim(surfaces: readonly MemberGrants[]): Claim {
  return {
    name: "every-grant-has-a-dependency",
    check: () => ({
      guidance: GUIDANCE,
      findings: surfaces.flatMap((surface) => {
        if (surface.dependsOn.length === 0) return [];
        const declared = new Set(surface.dependsOn);

        return surface.grants
          .filter((grant) => !declared.has(grant.dependency))
          .map((grant) => ({
            severity: "error" as const,
            message: `allows ${grant.member}, but package.json does not depend on ${grant.dependency}`,
            file: surface.configPath,
            start: null,
          }));
      }),
    }),
  };
}

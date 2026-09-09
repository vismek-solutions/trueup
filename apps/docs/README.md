# trueup docs

The documentation site, built with Astro and Starlight.

```sh
pnpm -C apps/docs dev
pnpm -C apps/docs build
```

Content lives in src/content/docs. The sidebar is declared in astro.config.mjs, so a new page needs an entry there as well as a file.

This app is deliberately not a member of the workspace rulebook. A docs site has no layering worth constraining, so the root rulebook covers it with a single docs zone that neither reaches the package nor is reachable from it. Astro's build time import names are declared as externals, and its generated directory is not walked.

Set the site option in astro.config.mjs once the domain is known. Without it the sitemap integration is skipped.

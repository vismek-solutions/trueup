# trueup docs

The documentation site, built with Astro and Starlight.

```sh
pnpm -C apps/docs dev
pnpm -C apps/docs build
```

Content lives in `src/content/docs`. The sidebar is declared in `astro.config.mjs`, so a new page needs an entry there as well as a file.

This app is deliberately not a `members` entry. A docs site has no layering worth constraining, so the root rulebook covers it with a single `docs` zone that neither reaches the package nor is reachable from it. Astro's build-time specifiers are declared in `externals`, and its generated `.astro` directory is not walked.

Set `site` in `astro.config.mjs` once the domain is known — the sitemap integration is skipped without it.

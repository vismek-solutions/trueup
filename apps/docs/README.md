# trueup docs

The documentation site, built with Astro and Starlight.

```sh
pnpm -C apps/docs dev
pnpm -C apps/docs build
```

Content lives in src/content/docs. The sidebar is declared in astro.config.mjs, so a new page needs an entry there as well as a file.

This app is deliberately not a member of the workspace rulebook. A docs site has no layering worth constraining, so the root rulebook covers it with a single docs zone that neither reaches the package nor is reachable from it. Astro's build time import names are declared as externals, and its generated directory is not walked.

## Where it is published

A push to main builds the site and deploys it to GitHub Pages:

```
https://vismek-solutions.github.io/trueup/
```

The workflow behind that is .github/workflows/pages.yml. It enables Pages on the repository the first time it runs, so the only setting a person has to touch is the repository being public.

## Links carry a base path

That address ends in a path segment rather than a bare domain, so astro.config.mjs sets a matching base and every page URL starts with it. Astro leaves links inside a page alone, so the plugin in base-links.mjs adds the prefix while the page renders. Write a link from the site root and it comes out right:

```md
[Seams](/checks/seams/)
```

The plugin sees the body of a page and nothing else. Starlight prints a hero action link from the frontmatter exactly as written, so make that one relative, with no leading slash:

```yaml
hero:
  actions:
    - text: Getting started
      link: start/getting-started/
```

Both forms work unchanged in the dev server, which serves under the same base.

Moving the site to its own domain means dropping the base and the plugin, and making those hero links absolute again.

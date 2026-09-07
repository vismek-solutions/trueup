# trueline docs

The documentation site, built with Astro and Starlight.

```sh
pnpm -C apps/docs dev
pnpm -C apps/docs build
```

Content lives in `src/content/docs`. The sidebar is declared in `astro.config.mjs`, so a new page needs an entry there as well as a file.

## Two files are missing, on purpose

`astro.config.mjs` and `src/content.config.ts` are not here yet. The write-time guard refused to create them, correctly: both are analysed source, neither matches a zone, and `astro:content` does not resolve. Creating them needs a change to the root rulebook, and that decision is not an agent's to make.

Apply this to `trueline.config.ts` first:

```ts
zones: [{ name: "docs", patterns: ["apps/docs/**"] }],
boundaries: [
  { from: "docs", mayNotReach: ["trueline"] },
  { from: "trueline", mayNotReach: ["docs"] },
],
externals: ["astro:*"],
ignoreDirectories: [...IGNORED_DIRECTORIES, "fixtures", ".astro"],
```

Then the two files can be written. Both are verified to build against Astro 7.3.1 and Starlight 0.42.0.

Until they exist, `fallow/unused_dependencies` and `fallow/unused_files` report this directory, because nothing imports the stylesheet or the Astro packages yet. Both clear once the config lands.

# trueup

Checks that a TypeScript codebase still has the shape you meant it to have, and blocks an edit that would change it.

Start with [the package readme](packages/trueup/README.md) for what it is and how to set it up. The full guides live in [apps/docs](apps/docs/src/content/docs).

```
packages/trueup    the checker, the CLI, and the write-time guard
apps/docs          the documentation site
trueup.config.ts   what this repo asserts about itself
```

Run it on this repo:

```
pnpm run check
```

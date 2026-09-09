# trueup

Checks that a TypeScript codebase still has the shape you meant it to have, and blocks an edit that would change it.

The tool and its documentation live in [packages/trueup](packages/trueup/README.md).

```
packages/trueup    the checker, the CLI, and the write-time guard
trueup.config.ts   what this repo asserts about itself
```

Run it on this repo:

```
pnpm run check
```

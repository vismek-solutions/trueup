# trueline

Checks that a TypeScript codebase still has the shape you meant it to have, and blocks an edit that would change it.

The tool and its documentation live in [`packages/trueline`](packages/trueline/README.md).

```
packages/trueline    the checker, the CLI, and the write-time guard
architecture.config  what this repo asserts about itself
```

Run it on this repo:

```
pnpm run check
```

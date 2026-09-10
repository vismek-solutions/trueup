import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { toPosix } from "../../paths/posix.ts";
import { pageFrom, type Page } from "./page.ts";

const EXTENSIONS = [".md", ".mdx"];

export const allPages = (directory: string): readonly Page[] =>
  readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && EXTENSIONS.includes(extname(entry.name)))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      const key = toPosix(relative(directory, path)).replace(/\.mdx?$/, "");
      return pageFrom(key, readFileSync(path, "utf8"));
    })
    .sort((left, right) => left.key.localeCompare(right.key));

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join } from "node:path";
import type {
  Declaration,
  Mention,
  ParseSources,
  SourceFacts,
} from "../../ports/module-record.ts";
import type { Span } from "../../ports/span.ts";
import { commentsOf } from "../text/comments.ts";
import { parseEach } from "./oxc-parse.ts";

export const CACHE_DIRECTORY = ".trueup-cache";
const STORE = "facts.json";
const READERS = ["./oxc-parse", "./facts-cache", "../text/comments"];

interface Entry {
  readonly hash: string;
  readonly record: SourceFacts["record"];
  readonly names: readonly string[];
  readonly mentions: readonly number[];
  readonly declarations: readonly number[];
  readonly comments: readonly number[];
}

interface Store {
  readonly parser: string;
  readonly files: Readonly<Record<string, Entry>>;
}

const parserIdentity = (): string => {
  const hash = createHash("sha1");
  const { version } = createRequire(import.meta.url)("oxc-parser/package.json") as { version: string };
  hash.update(version);
  for (const reader of READERS) {
    hash.update(readFileSync(new URL(`${reader}${extname(import.meta.filename)}`, import.meta.url)));
  }

  return hash.digest("base64");
};

const hashOf = (text: string): string => createHash("sha1").update(text).digest("base64");

const encode = (hash: string, facts: SourceFacts): Entry => {
  const names: string[] = [];
  const indexes = new Map<string, number>();
  const indexOf = (name: string): number => {
    const known = indexes.get(name);
    if (known !== undefined) return known;

    indexes.set(name, names.length);
    names.push(name);
    return names.length - 1;
  };

  const mentions: number[] = [];
  for (const mention of facts.mentions) {
    mentions.push(indexOf(mention.text) * 2 + (mention.form === "string" ? 1 : 0), mention.start);
  }

  const declarations: number[] = [];
  for (const declaration of facts.declarations) {
    declarations.push(indexOf(declaration.name), declaration.start, declaration.end, declaration.text.length);
  }

  const comments: number[] = [];
  for (const comment of facts.comments) comments.push(comment.start, comment.end);

  return { hash, record: facts.record, names, mentions, declarations, comments };
};

const decode = (entry: Entry, text: string): SourceFacts => {
  const { names } = entry;

  const mentions: Mention[] = [];
  for (let at = 0; at < entry.mentions.length; at += 2) {
    const code = entry.mentions[at] ?? 0;
    const form = code % 2 === 1 ? "string" : "name";
    mentions.push({ text: names[code >> 1] ?? "", form, start: entry.mentions[at + 1] ?? 0 });
  }

  // a declaration's text runs from the end of its name to its own end
  const declarations: Declaration[] = [];
  for (let at = 0; at < entry.declarations.length; at += 4) {
    const end = entry.declarations[at + 2] ?? 0;
    const length = entry.declarations[at + 3] ?? 0;
    const name = names[entry.declarations[at] ?? 0] ?? "";
    declarations.push({ name, text: text.slice(end - length, end), start: entry.declarations[at + 1] ?? 0, end });
  }

  const bounds: Pick<Span, "start" | "end">[] = [];
  for (let at = 0; at < entry.comments.length; at += 2) {
    bounds.push({ start: entry.comments[at] ?? 0, end: entry.comments[at + 1] ?? 0 });
  }

  return { record: entry.record, mentions, declarations, comments: commentsOf(bounds, text) };
};

const readStore = (path: string, parser: string): Store["files"] => {
  try {
    const store = JSON.parse(readFileSync(path, "utf8")) as Store;
    return store.parser === parser ? store.files : {};
  } catch {
    return {};
  }
};

const writeStore = (directory: string, store: Store): void => {
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, ".gitignore"), "*\n");
    const partial = join(directory, `${STORE}.${process.pid}`);
    writeFileSync(partial, JSON.stringify(store));
    renameSync(partial, join(directory, STORE));
  } catch {
    // a store that cannot be written costs the next run a parse, never a wrong answer
  }
};

export const cachedParse =
  (root: string): ParseSources =>
  (sources) => {
    const directory = join(root, CACHE_DIRECTORY);
    const parser = parserIdentity();
    const stored = readStore(join(directory, STORE), parser);
    const files: Record<string, Entry> = {};
    const facts = new Map<string, SourceFacts>();
    const missed = new Map<string, string>();
    const hashes = new Map<string, string>();

    for (const [path, text] of sources) {
      const hash = hashOf(text);
      const kept = stored[path];
      if (kept?.hash === hash) {
        files[path] = kept;
        facts.set(path, decode(kept, text));
        continue;
      }

      hashes.set(path, hash);
      missed.set(path, text);
    }

    if (missed.size === 0) return facts;

    for (const [path, fresh] of parseEach(missed)) {
      files[path] = encode(hashes.get(path) ?? "", fresh);
      facts.set(path, fresh);
    }

    writeStore(directory, { parser, files });

    const inSourceOrder = new Map<string, SourceFacts>();
    for (const path of sources.keys()) {
      const found = facts.get(path);
      if (found !== undefined) inSourceOrder.set(path, found);
    }
    return inSourceOrder;
  };

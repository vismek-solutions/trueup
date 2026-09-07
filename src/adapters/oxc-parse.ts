import { parseSync } from "oxc-parser";
import {
  DEFAULT,
  NAMESPACE,
  type BindingKind,
  type ExportEntry,
  type ImportBinding,
  type ImportStatement,
  type Mention,
  type ModuleRecord,
  type ParseModule,
  type ReadMentions,
} from "../ports/module-record.ts";

interface AstNode {
  readonly type?: unknown;
  readonly [key: string]: unknown;
}

type Module = ReturnType<typeof parseSync>["module"];
type ImportRecord = Module["staticImports"][number];
type ExportRecord = Module["staticExports"][number]["entries"][number];

const SKIPPED_SUBTREES = new Set(["ImportDeclaration", "ExportAllDeclaration", "TSImportType"]);
const POSITION_KEYS = new Set(["type", "start", "end"]);

const ONLY_CHILD: Readonly<Record<string, string>> = {
  ExportNamedDeclaration: "declaration",
  ExportDefaultDeclaration: "declaration",
  ImportExpression: "options",
};

const mentionOf = (current: AstNode, type: string | null): Mention | null => {
  if (typeof current.start !== "number") return null;

  if (type === "Identifier" || type === "JSXIdentifier") {
    return typeof current.name === "string"
      ? { text: current.name, form: "name", start: current.start }
      : null;
  }
  if (type === "Literal") {
    return typeof current.value === "string"
      ? { text: current.value, form: "string", start: current.start }
      : null;
  }

  return null;
};

type Visit = (node: unknown) => void;

const descend = (current: AstNode, type: string | null, visit: Visit): void => {
  const only = type === null ? undefined : ONLY_CHILD[type];
  if (only !== undefined) {
    visit(current[only]);
    return;
  }

  for (const key of Object.keys(current)) {
    if (!POSITION_KEYS.has(key)) visit(current[key]);
  }
};

const collectMentions = (program: unknown): Mention[] => {
  const mentions: Mention[] = [];

  const visit: Visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    const current = node as AstNode;
    const type = typeof current.type === "string" ? current.type : null;
    if (type !== null && SKIPPED_SUBTREES.has(type)) return;

    const mention = mentionOf(current, type);
    if (mention !== null) mentions.push(mention);

    descend(current, type, visit);
  };

  visit(program);
  return mentions;
};

const importedNameOf = (importName: ImportRecord["entries"][number]["importName"]): string => {
  if (importName.kind === "NamespaceObject") return NAMESPACE;
  if (importName.kind === "Default") return DEFAULT;
  return importName.name ?? DEFAULT;
};

const statementOf = (statement: ImportRecord): ImportStatement => {
  const bindings: ImportBinding[] = statement.entries.map((entry) => ({
    imported: importedNameOf(entry.importName),
    local: entry.localName.value,
    kind: entry.isType ? "type" : "value",
    start: entry.localName.start,
  }));

  return { specifier: statement.moduleRequest.value, start: statement.start, bindings };
};

const exportEntryOf = (entry: ExportRecord): ExportEntry | null => {
  const kind: BindingKind = entry.isType ? "type" : "value";
  const start = entry.start;
  const request = entry.moduleRequest;
  const exported = entry.exportName.kind === "Default" ? DEFAULT : entry.exportName.name;

  if (request === null) {
    return exported === null
      ? null
      : { form: "local", exported, local: entry.localName.name ?? exported, kind, start };
  }

  if (entry.importName.kind === "AllButDefault") {
    return { form: "re-export-star", specifier: request.value, kind, start };
  }
  if (exported === null) return null;
  if (entry.importName.kind === "All") {
    return { form: "re-export-namespace", exported, specifier: request.value, kind, start };
  }

  return {
    form: "re-export-named",
    exported,
    imported: entry.importName.name ?? DEFAULT,
    specifier: request.value,
    kind,
    start,
  };
};

export const readMentions: ReadMentions = (path, text) => collectMentions(parseSync(path, text).program);

export const parseModule: ParseModule = (path, text): ModuleRecord => {
  const { module } = parseSync(path, text);

  const exports = module.staticExports
    .flatMap((statement) => statement.entries.map(exportEntryOf))
    .filter((entry): entry is ExportEntry => entry !== null);

  return { path, imports: module.staticImports.map(statementOf), exports };
};

import { parseSync } from "oxc-parser";
import {
  DEFAULT,
  NAMESPACE,
  type BindingKind,
  type Declaration,
  type ExportEntry,
  type ImportBinding,
  type ImportStatement,
  type Mention,
  type ModuleRecord,
  type ParseModule,
  type ReadDeclarations,
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

const NAMED_DECLARATIONS = new Set([
  "FunctionDeclaration",
  "ClassDeclaration",
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
]);

const spanOf = (node: AstNode): { start: number; end: number } | null =>
  typeof node.start === "number" && typeof node.end === "number"
    ? { start: node.start, end: node.end }
    : null;

const identifierOf = (node: AstNode): AstNode | null => {
  const id = node.id as AstNode | null | undefined;
  return id !== null && id !== undefined && typeof id.name === "string" ? id : null;
};

const bodyAfterName = (node: AstNode, id: AstNode, text: string): string | null => {
  const span = spanOf(node);
  const from = typeof id.end === "number" ? id.end : null;
  return span === null || from === null ? null : text.slice(from, span.end);
};

const namedOf = (node: AstNode, text: string): Declaration | null => {
  const id = identifierOf(node);
  if (id === null) return null;

  const body = bodyAfterName(node, id, text);
  const span = spanOf(node);
  return body === null || span === null ? null : { name: id.name as string, text: body, start: span.start };
};

const unwrapped = (node: AstNode): AstNode => {
  if (node.type !== "ExportNamedDeclaration" && node.type !== "ExportDefaultDeclaration") return node;
  const inner = node.declaration as AstNode | null | undefined;
  return inner === null || inner === undefined ? node : inner;
};

const declarationsOf = (raw: AstNode, text: string, into: Declaration[]): void => {
  const node = unwrapped(raw);
  const type = typeof node.type === "string" ? node.type : null;
  if (type === null) return;

  if (type === "VariableDeclaration") {
    for (const entry of (node.declarations ?? []) as AstNode[]) {
      const found = namedOf(entry, text);
      if (found !== null) into.push(found);
    }
    return;
  }

  if (!NAMED_DECLARATIONS.has(type)) return;
  const found = namedOf(node, text);
  if (found !== null) into.push(found);
};

export const readMentions: ReadMentions = (path, text) => collectMentions(parseSync(path, text).program);

export const readDeclarations: ReadDeclarations = (path, text) => {
  const body = parseSync(path, text).program.body as unknown as AstNode[];
  const found: Declaration[] = [];
  for (const node of body) declarationsOf(node, text, found);
  return found;
};

export const parseModule: ParseModule = (path, text): ModuleRecord => {
  const { module } = parseSync(path, text);

  const exports = module.staticExports
    .flatMap((statement) => statement.entries.map(exportEntryOf))
    .filter((entry): entry is ExportEntry => entry !== null);

  return { path, imports: module.staticImports.map(statementOf), exports };
};

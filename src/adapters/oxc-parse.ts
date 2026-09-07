import { parseSync } from "oxc-parser";
import {
  DEFAULT,
  NAMESPACE,
  type ExportEntry,
  type ImportBinding,
  type ImportStatement,
  type Mention,
  type ModuleRecord,
  type ParseModule,
} from "../ports/module-record.ts";

interface AstNode {
  readonly type?: unknown;
  readonly [key: string]: unknown;
}

const SKIPPED_SUBTREES = new Set(["ImportDeclaration", "ExportAllDeclaration", "TSImportType"]);

const collectMentions = (program: unknown): Mention[] => {
  const mentions: Mention[] = [];

  const visit = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    const current = node as AstNode;
    const type = typeof current.type === "string" ? current.type : null;
    if (type !== null && SKIPPED_SUBTREES.has(type)) return;

    if (type === "Identifier" || type === "JSXIdentifier") {
      if (typeof current.name === "string" && typeof current.start === "number") {
        mentions.push({ text: current.name, form: "name", start: current.start });
      }
    } else if (type === "Literal") {
      if (typeof current.value === "string" && typeof current.start === "number") {
        mentions.push({ text: current.value, form: "string", start: current.start });
      }
    } else if (type === "ExportNamedDeclaration" || type === "ExportDefaultDeclaration") {
      visit(current.declaration);
      return;
    } else if (type === "ImportExpression") {
      visit(current.options);
      return;
    }

    for (const key of Object.keys(current)) {
      if (key === "type" || key === "start" || key === "end") continue;
      visit(current[key]);
    }
  };

  visit(program);
  return mentions;
};

export const parseModule: ParseModule = (path, text): ModuleRecord => {
  const { module, program } = parseSync(path, text);

  const imports: ImportStatement[] = module.staticImports.map((statement) => {
    const bindings: ImportBinding[] = statement.entries.map((entry) => ({
      imported:
        entry.importName.kind === "NamespaceObject"
          ? NAMESPACE
          : entry.importName.kind === "Default"
            ? DEFAULT
            : (entry.importName.name ?? DEFAULT),
      local: entry.localName.value,
      kind: entry.isType ? "type" : "value",
      start: entry.localName.start,
    }));
    return { specifier: statement.moduleRequest.value, start: statement.start, bindings };
  });

  const exports: ExportEntry[] = [];
  for (const statement of module.staticExports) {
    for (const entry of statement.entries) {
      const kind = entry.isType ? "type" : "value";
      const start = entry.start;
      const request = entry.moduleRequest;

      if (request === null) {
        const exported = entry.exportName.kind === "Default" ? DEFAULT : entry.exportName.name;
        if (exported === null) continue;
        const local = entry.localName.name ?? exported;
        exports.push({ form: "local", exported, local, kind, start });
        continue;
      }

      if (entry.importName.kind === "AllButDefault") {
        exports.push({ form: "re-export-star", specifier: request.value, kind, start });
        continue;
      }

      const exported = entry.exportName.kind === "Default" ? DEFAULT : entry.exportName.name;
      if (exported === null) continue;

      if (entry.importName.kind === "All") {
        exports.push({ form: "re-export-namespace", exported, specifier: request.value, kind, start });
        continue;
      }

      exports.push({
        form: "re-export-named",
        exported,
        imported: entry.importName.name ?? DEFAULT,
        specifier: request.value,
        kind,
        start,
      });
    }
  }

  return { path, imports, exports, mentions: collectMentions(program) };
};

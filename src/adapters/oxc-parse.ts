import { parseSync } from "oxc-parser";
import {
  DEFAULT,
  NAMESPACE,
  type ExportEntry,
  type ImportBinding,
  type ImportStatement,
  type ModuleRecord,
  type ParseModule,
} from "../ports/module-record.ts";

export const parseModule: ParseModule = (path, text): ModuleRecord => {
  const { module } = parseSync(path, text);

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

  return { path, imports, exports };
};

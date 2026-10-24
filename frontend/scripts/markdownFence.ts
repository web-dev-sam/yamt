import { posix } from "node:path";

import ts from "typescript";

type MarkdownViolation = {
  readonly rule: "PM2";
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
};

const QUERY_SUFFIX = /\?.*$/;
const UI_FILE = /^src\/ui\//;
const EDITOR = "src/editor";
const MARKDOWN_SEAM = "src/ui/useMarkdown.ts";
const MARKDOWN_VIEW = "MarkdownView";
const MARKDOWN_MODULE = "src/editor/markdown";

function namesOf(statement: ts.ImportDeclaration | ts.ExportDeclaration): string[] | "all" {
  const bindings = ts.isImportDeclaration(statement)
    ? statement.importClause?.namedBindings
    : statement.exportClause;
  if (bindings === undefined) {
    return ts.isExportDeclaration(statement) ? "all" : [];
  }
  if (ts.isNamespaceImport(bindings) || ts.isNamespaceExport(bindings)) {
    return "all";
  }
  const elements: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[] = bindings.elements;
  return elements.map((element) => (element.propertyName ?? element.name).text);
}

function exposesMarkdownView(path: string, statement: ts.Statement): string | undefined {
  if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) {
    return undefined;
  }
  const literal = statement.moduleSpecifier;
  const specifier = literal !== undefined && ts.isStringLiteral(literal) ? literal.text : "";
  const bare = specifier.replace(QUERY_SUFFIX, "");
  const target = bare.startsWith(".") ? posix.join(posix.dirname(path), bare) : "";
  if (target !== EDITOR && !target.startsWith(`${EDITOR}/`)) {
    return undefined;
  }
  const names = namesOf(statement);
  const direct = target === MARKDOWN_MODULE || target === `${MARKDOWN_MODULE}.ts`;
  return direct || names === "all" || names.includes(MARKDOWN_VIEW) ? specifier : undefined;
}

export function markdownViolations(path: string, texts: readonly string[]): MarkdownViolation[] {
  if (!UI_FILE.test(path) || path === MARKDOWN_SEAM) {
    return [];
  }
  return texts.flatMap((text) =>
    ts
      .createSourceFile(path, text, ts.ScriptTarget.Latest)
      .statements.flatMap((statement) => exposesMarkdownView(path, statement) ?? [])
      .map((specifier): MarkdownViolation => ({
        rule: "PM2",
        file: path,
        specifier,
        reason: "ui/ reaches MarkdownView only through ui/useMarkdown.ts (plan §2 #112)",
      })),
  );
}

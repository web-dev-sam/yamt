import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readSourceTree, type SourceFile } from "./fences";
import { tailwindThemeSpans, themeBlockSpans, type Span } from "./themes";

export type PaletteViolation = {
  readonly rule: "literal" | "unknown-token";
  readonly file: string;
  readonly line: number;
  readonly match: string;
};

const TOKEN_DEFINITION = /--color-([\w-]+)\s*:/g;
const TOKEN_USE = /--color-([\w-]+)/g;
const VAR_OPENER = /var\(\s*$/;
const HEX_COLOUR =
  /(?<![A-Za-z0-9])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![A-Za-z0-9-])/g;
const FUNCTIONAL_COLOUR = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;

function definedTokens(files: readonly SourceFile[]): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    for (const span of tailwindThemeSpans(file)) {
      for (const definition of file.text.slice(span.start, span.end).matchAll(TOKEN_DEFINITION)) {
        names.add(definition[1] ?? "");
      }
    }
  }
  return names;
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

function inside(spans: readonly Span[], index: number): boolean {
  return spans.some(({ start, end }) => index >= start && index < end);
}

function literalFindings(file: SourceFile, palette: readonly Span[]): PaletteViolation[] {
  const matches = [...file.text.matchAll(HEX_COLOUR), ...file.text.matchAll(FUNCTIONAL_COLOUR)];
  return matches
    .filter((match) => !inside(palette, match.index))
    .map((match) => ({
      rule: "literal",
      file: file.path,
      line: lineAt(file.text, match.index),
      match: match[0],
    }));
}

function tokenFindings(
  file: SourceFile,
  palette: readonly Span[],
  defined: Set<string>,
): PaletteViolation[] {
  return [...file.text.matchAll(TOKEN_USE)]
    .filter((use) => !defined.has(use[1] ?? ""))
    .filter((use) => !inside(palette, use.index) || VAR_OPENER.test(file.text.slice(0, use.index)))
    .map((use) => ({
      rule: "unknown-token",
      file: file.path,
      line: lineAt(file.text, use.index),
      match: use[0],
    }));
}

export function findPaletteViolations(files: readonly SourceFile[]): PaletteViolation[] {
  const defined = definedTokens(files);
  return files.flatMap((file) => {
    const spans = themeBlockSpans(file);
    return [...literalFindings(file, spans), ...tokenFindings(file, spans, defined)].toSorted(
      (left, right) => left.line - right.line,
    );
  });
}

export function readPaletteSources(frontendRoot: string): SourceFile[] {
  const styles = globSync("src/**/*.css", { cwd: frontendRoot })
    .toSorted()
    .map((path) => ({ path, text: readFileSync(join(frontendRoot, path), "utf8") }));
  return [...readSourceTree(frontendRoot), ...styles];
}

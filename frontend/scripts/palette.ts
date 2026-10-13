import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readSourceTree, type SourceFile } from "./fences";

export type PaletteViolation = {
  readonly rule:
    | "literal"
    | "unknown-token"
    | "light-missing"
    | "light-extra"
    | "window-background";
  readonly file: string;
  readonly line: number;
  readonly match: string;
};

type Span = { readonly start: number; readonly end: number };
type Definition = { readonly name: string; readonly value: string; readonly index: number };
type Background = { readonly hex: string; readonly index: number };

const PALETTE_FILE = "src/style.css";
export const WINDOW_FILE = "../src-tauri/src/window.rs";
const THEME_OPENER = /@theme(?:\s+(?:static|inline))?\s*\{/g;
const LIGHT_OPENER = /:root\[data-theme="light"\]\s*\{/g;
const TOKEN_DEFINITION = /--color-([\w-]+)\s*:/g;
const TOKEN_VALUE = /--color-([\w-]+)\s*:\s*([^;]+);/g;
const TOKEN_USE = /--color-([\w-]+)/g;
const VAR_OPENER = /var\(\s*$/;
const HEX_COLOUR =
  /(?<![A-Za-z0-9])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![A-Za-z0-9-])/g;
const FUNCTIONAL_COLOUR = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const WINDOW_BACKGROUND =
  /const (BACKGROUND_DARK|BACKGROUND_LIGHT): Color = Color\(0x([0-9a-f]{2}), 0x([0-9a-f]{2}), 0x([0-9a-f]{2}), 0xff\);/gi;
const WINDOW_TOKEN = "window";

function blockEnd(text: string, afterOpener: number): number {
  let depth = 1;
  for (let index = afterOpener; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") depth -= 1;
    if (depth === 0) return index + 1;
  }
  return text.length;
}

function blockSpans(file: SourceFile, opener: RegExp): Span[] {
  if (file.path !== PALETTE_FILE) return [];
  return [...file.text.matchAll(opener)].map((found) => {
    const afterOpener = found.index + found[0].length;
    return { start: found.index, end: blockEnd(file.text, afterOpener) };
  });
}

function paletteSpans(file: SourceFile): Span[] {
  return [...blockSpans(file, THEME_OPENER), ...blockSpans(file, LIGHT_OPENER)];
}

function definitionsIn(file: SourceFile, spans: readonly Span[]): Definition[] {
  return spans.flatMap(({ start, end }) =>
    [...file.text.slice(start, end).matchAll(TOKEN_VALUE)].map((found) => {
      const [, name = "", value = ""] = found;
      return { name, value: value.trim().toLowerCase(), index: start + found.index };
    }),
  );
}

function definedTokens(files: readonly SourceFile[]): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    for (const span of blockSpans(file, THEME_OPENER)) {
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

function lightFindings(file: SourceFile): PaletteViolation[] {
  const dark = definitionsIn(file, blockSpans(file, THEME_OPENER));
  const darkNames = new Set(dark.map(({ name }) => name));
  return blockSpans(file, LIGHT_OPENER).flatMap((span) => {
    const lightNames = new Set(definitionsIn(file, [span]).map(({ name }) => name));
    const missing = dark
      .filter(({ name }) => !lightNames.has(name))
      .map(({ name }): PaletteViolation => ({
        rule: "light-missing",
        file: file.path,
        line: lineAt(file.text, span.start),
        match: `--color-${name}`,
      }));
    const extra = definitionsIn(file, [span])
      .filter(({ name }) => !darkNames.has(name))
      .map(({ name, index }): PaletteViolation => ({
        rule: "light-extra",
        file: file.path,
        line: lineAt(file.text, index),
        match: `--color-${name}`,
      }));
    return [...missing, ...extra];
  });
}

function windowColour(file: SourceFile, opener: RegExp): string | undefined {
  return definitionsIn(file, blockSpans(file, opener)).find(({ name }) => name === WINDOW_TOKEN)
    ?.value;
}

function windowFindings(palette: SourceFile, shell: SourceFile): PaletteViolation[] {
  const expected: Readonly<Record<string, string | undefined>> = {
    BACKGROUND_DARK: windowColour(palette, THEME_OPENER),
    BACKGROUND_LIGHT: windowColour(palette, LIGHT_OPENER),
  };
  const found = new Map(
    [...shell.text.matchAll(WINDOW_BACKGROUND)].map((constant): [string, Background] => {
      const [, name = "", red = "", green = "", blue = ""] = constant;
      return [name, { hex: `#${red}${green}${blue}`.toLowerCase(), index: constant.index }];
    }),
  );
  return Object.entries(expected).flatMap(([name, colour]): PaletteViolation[] => {
    const constant = found.get(name);
    if (constant !== undefined && constant.hex === colour) return [];
    const line = constant === undefined ? 1 : lineAt(shell.text, constant.index);
    return [{ rule: "window-background", file: shell.path, line, match: name }];
  });
}

export function findPaletteViolations(files: readonly SourceFile[]): PaletteViolation[] {
  const sources = files.filter((file) => file.path !== WINDOW_FILE);
  const defined = definedTokens(sources);
  const palette = sources.find((file) => file.path === PALETTE_FILE);
  const shell = files.find((file) => file.path === WINDOW_FILE);
  const native = palette === undefined || shell === undefined ? [] : windowFindings(palette, shell);
  return [
    ...sources.flatMap((file) => {
      const spans = paletteSpans(file);
      const light = file.path === PALETTE_FILE ? lightFindings(file) : [];
      return [
        ...literalFindings(file, spans),
        ...tokenFindings(file, spans, defined),
        ...light,
      ].toSorted((left, right) => left.line - right.line);
    }),
    ...native,
  ];
}

export function readPaletteSources(frontendRoot: string): SourceFile[] {
  const styles = globSync("src/**/*.css", { cwd: frontendRoot })
    .toSorted()
    .map((path) => ({ path, text: readFileSync(join(frontendRoot, path), "utf8") }));
  const windowPath = join(frontendRoot, WINDOW_FILE);
  const shell = existsSync(windowPath)
    ? [{ path: WINDOW_FILE, text: readFileSync(windowPath, "utf8") }]
    : [];
  return [...readSourceTree(frontendRoot), ...styles, ...shell];
}

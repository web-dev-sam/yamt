import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { SourceFile } from "./fences";

export type ThemeViolation = {
  readonly rule:
    | "missing-block"
    | "extra-block"
    | "missing-token"
    | "extra-token"
    | "bad-value"
    | "no-source"
    | "window-background"
    | "window-arm";
  readonly file: string;
  readonly line: number;
  readonly match: string;
};

export type Span = { readonly start: number; readonly end: number };
type Definition = {
  readonly name: string;
  readonly value: string;
  readonly sourced: boolean;
  readonly line: number;
};
type Block = {
  readonly theme: string;
  readonly file: string;
  readonly line: number;
  readonly definitions: readonly Definition[];
};
type Located = { readonly line: number };
type Constant = Located & { readonly hex: string };
type Arm = Located & { readonly variant: string; readonly constant: string };

const BINDINGS_FILE = "src/ipc/bindings.ts";
const PALETTE_FILE = "src/style.css";
export const WINDOW_FILE = "src-tauri/src/window.rs";
const THEME_FILE = /^src\/themes\/([\w-]+)\.css$/;
const DEFAULT_THEME = "dark";
const YAMT_THEMES: Readonly<Record<string, true>> = { dark: true, light: true };
const THEME_OPENER = /@theme(?:\s+(?:static|inline))?\s*\{/g;
const BLOCK_OPENER = /:root\[data-theme="([^"]*)"\]\s*\{/g;
const THEME_UNION = /export type Theme =([^;]+);/;
const QUOTED = /"([^"]+)"/g;
const DEFINITION = /^\s*(--[\w-]+)\s*:\s*([^;]*);\s*(.*)$/;
const SOURCE_COMMENT = /^\/\*.*\S.*\*\/$/;
const THEMED_TOKEN =
  /^--(?:color-[\w-]+|radius-island|spacing-island|island-line|syntax-[\w-]+-(?:style|weight|line))$/;
const ALLOWED_VALUES: readonly { readonly name: RegExp; readonly value: RegExp }[] = [
  { name: /^--syntax-[\w-]+-style$/, value: /^(?:normal|italic)$/ },
  { name: /^--syntax-[\w-]+-weight$/, value: /^(?:normal|bold)$/ },
  { name: /^--syntax-[\w-]+-line$/, value: /^(?:none|underline|line-through)$/ },
  { name: /^--(?:radius-island|spacing-island|island-line)$/, value: /^\d+px$/ },
];
const WINDOW_TOKEN = "--color-window";
const BACKGROUND_CONSTANT =
  /const (BACKGROUND_\w+): Color = Color\(0x([0-9a-f]{2}), 0x([0-9a-f]{2}), 0x([0-9a-f]{2}), 0xff\);/gi;
const BACKGROUND_FUNCTION = /fn background\([^)]*\)[^{]*\{/;
const BACKGROUND_ARM = /Theme::(\w+)\s*=>\s*(\w+)/g;

function blockEnd(text: string, afterOpener: number): number {
  let depth = 1;
  for (let index = afterOpener; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") depth -= 1;
    if (depth === 0) return index + 1;
  }
  return text.length;
}

function spansOf(text: string, opener: RegExp): (Span & { readonly opened: RegExpExecArray })[] {
  return [...text.matchAll(opener)].map((opened) => ({
    start: opened.index,
    end: blockEnd(text, opened.index + opened[0].length),
    opened,
  }));
}

export function tailwindThemeSpans(file: SourceFile): Span[] {
  return file.path === PALETTE_FILE ? spansOf(file.text, THEME_OPENER) : [];
}

export function themeBlockSpans(file: SourceFile): Span[] {
  const themeFile = THEME_FILE.test(file.path) ? spansOf(file.text, BLOCK_OPENER) : [];
  return [...tailwindThemeSpans(file), ...themeFile];
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

function definitionsIn(text: string, span: Span): Definition[] {
  const firstLine = lineAt(text, span.start);
  return text
    .slice(span.start, span.end)
    .split("\n")
    .flatMap((row, index) => {
      const found = DEFINITION.exec(row);
      if (found === null) return [];
      const [, name = "", value = "", rest = ""] = found;
      return [
        {
          name,
          value: value.trim().toLowerCase(),
          sourced: SOURCE_COMMENT.test(rest),
          line: firstLine + index,
        },
      ];
    });
}

function blocksOf(files: readonly SourceFile[]): Block[] {
  return files.flatMap((file): Block[] => {
    const dark = tailwindThemeSpans(file).map((span) => ({ theme: DEFAULT_THEME, span }));
    const named = spansOf(file.text, BLOCK_OPENER).map((span) => ({
      theme: span.opened[1] ?? "",
      span,
    }));
    return [...dark, ...named].map(({ theme, span }) => ({
      theme,
      file: file.path,
      line: lineAt(file.text, span.start),
      definitions: definitionsIn(file.text, span),
    }));
  });
}

function expectedFile(theme: string): string {
  return theme === DEFAULT_THEME ? PALETTE_FILE : `src/themes/${theme}.css`;
}

function themeNames(files: readonly SourceFile[]): string[] {
  const union = files.find(({ path }) => path === BINDINGS_FILE)?.text.match(THEME_UNION)?.[1];
  return [...(union ?? "").matchAll(QUOTED)].map((quoted) => quoted[1] ?? "");
}

function placedBlocks(
  names: readonly string[],
  blocks: readonly Block[],
): { readonly placed: ReadonlyMap<string, Block>; readonly findings: ThemeViolation[] } {
  const known = new Set(names);
  const placed = new Map<string, Block>();
  const extra: ThemeViolation[] = [];
  for (const block of blocks) {
    const fits = known.has(block.theme) && block.file === expectedFile(block.theme);
    if (fits && !placed.has(block.theme)) placed.set(block.theme, block);
    else
      extra.push({ rule: "extra-block", file: block.file, line: block.line, match: block.theme });
  }
  const missing = names
    .filter((name) => !placed.has(name))
    .map((name): ThemeViolation => {
      return { rule: "missing-block", file: expectedFile(name), line: 1, match: name };
    });
  return { placed, findings: [...missing, ...extra] };
}

function tokenFindings(block: Block, reference: ReadonlySet<string>): ThemeViolation[] {
  const names = new Set(block.definitions.map(({ name }) => name));
  const missing = [...reference]
    .filter((name) => !names.has(name))
    .map((name): ThemeViolation => {
      return { rule: "missing-token", file: block.file, line: block.line, match: name };
    });
  const extra = block.definitions
    .filter(({ name }) => !reference.has(name))
    .map(({ name, line }): ThemeViolation => {
      return { rule: "extra-token", file: block.file, line, match: name };
    });
  return [...missing, ...extra];
}

function valueFindings(block: Block): ThemeViolation[] {
  return block.definitions
    .filter(({ name, value }) =>
      ALLOWED_VALUES.some((allowed) => allowed.name.test(name) && !allowed.value.test(value)),
    )
    .map(({ name, value, line }): ThemeViolation => {
      return { rule: "bad-value", file: block.file, line, match: `${name}: ${value}` };
    });
}

function sourceFindings(block: Block): ThemeViolation[] {
  if (YAMT_THEMES[block.theme] === true) return [];
  return block.definitions
    .filter(({ sourced }) => !sourced)
    .map(({ name, line }): ThemeViolation => ({
      rule: "no-source",
      file: block.file,
      line,
      match: name,
    }));
}

function blockFindings(placed: ReadonlyMap<string, Block>): ThemeViolation[] {
  const dark = placed.get(DEFAULT_THEME)?.definitions ?? [];
  const reference = new Set(dark.map(({ name }) => name).filter((name) => THEMED_TOKEN.test(name)));
  return [...placed.values()].flatMap((block) => [
    ...(block.theme === DEFAULT_THEME ? [] : tokenFindings(block, reference)),
    ...valueFindings(block),
    ...sourceFindings(block),
  ]);
}

function constantOf(theme: string): string {
  return `BACKGROUND_${theme.toUpperCase().replaceAll("-", "_")}`;
}

function variantOf(theme: string): string {
  return theme
    .split("-")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join("");
}

function backgroundFindings(
  shell: SourceFile,
  placed: ReadonlyMap<string, Block>,
  names: readonly string[],
): ThemeViolation[] {
  const found = new Map(
    [...shell.text.matchAll(BACKGROUND_CONSTANT)].map((constant): [string, Constant] => {
      const [, name = "", red = "", green = "", blue = ""] = constant;
      const hex = `#${red}${green}${blue}`.toLowerCase();
      return [name, { hex, line: lineAt(shell.text, constant.index) }];
    }),
  );
  return names.flatMap((theme): ThemeViolation[] => {
    const window = placed.get(theme)?.definitions.find(({ name }) => name === WINDOW_TOKEN);
    const constant = found.get(constantOf(theme));
    if (constant !== undefined && constant.hex === window?.value) return [];
    const line = constant?.line ?? 1;
    return [{ rule: "window-background", file: shell.path, line, match: constantOf(theme) }];
  });
}

function backgroundArms(shell: SourceFile): Arm[] {
  const opener = BACKGROUND_FUNCTION.exec(shell.text);
  if (opener === null) return [];
  const start = opener.index + opener[0].length;
  const body = shell.text.slice(start, blockEnd(shell.text, start));
  return [...body.matchAll(BACKGROUND_ARM)].map((arm) => {
    const [, variant = "", constant = ""] = arm;
    return { variant, constant, line: lineAt(shell.text, start + arm.index) };
  });
}

function armFindings(shell: SourceFile, names: readonly string[]): ThemeViolation[] {
  const arms = backgroundArms(shell);
  const variants = new Map(names.map((theme) => [variantOf(theme), constantOf(theme)]));
  const wrong = arms
    .filter(({ variant, constant }, index) => {
      const first = arms.findIndex((other) => other.variant === variant) === index;
      return !first || variants.get(variant) !== constant;
    })
    .map(({ variant, line }): ThemeViolation => {
      return { rule: "window-arm", file: shell.path, line, match: `Theme::${variant}` };
    });
  const missing = [...variants.keys()]
    .filter((variant) => !arms.some((arm) => arm.variant === variant))
    .map((variant): ThemeViolation => {
      return { rule: "window-arm", file: shell.path, line: 1, match: `Theme::${variant}` };
    });
  return [...wrong, ...missing];
}

export function findThemeViolations(files: readonly SourceFile[]): ThemeViolation[] {
  const names = themeNames(files);
  const { placed, findings } = placedBlocks(names, blocksOf(files));
  const shell = files.find(({ path }) => path === WINDOW_FILE);
  const native =
    shell === undefined
      ? []
      : [...backgroundFindings(shell, placed, names), ...armFindings(shell, names)];
  return [...findings, ...blockFindings(placed), ...native];
}

function findAbove(folder: string, relativePath: string): string | undefined {
  const candidate = join(folder, relativePath);
  if (existsSync(candidate)) return candidate;
  const parent = dirname(folder);
  return parent === folder ? undefined : findAbove(parent, relativePath);
}

export function readThemeSources(frontendRoot: string): SourceFile[] {
  const themes = globSync("src/themes/*.css", { cwd: frontendRoot }).toSorted();
  const sources = [BINDINGS_FILE, PALETTE_FILE, ...themes]
    .filter((path) => existsSync(join(frontendRoot, path)))
    .map((path) => ({ path, text: readFileSync(join(frontendRoot, path), "utf8") }));
  const windowPath = findAbove(frontendRoot, WINDOW_FILE);
  const shell =
    windowPath === undefined ? [] : [{ path: WINDOW_FILE, text: readFileSync(windowPath, "utf8") }];
  return [...sources, ...shell];
}

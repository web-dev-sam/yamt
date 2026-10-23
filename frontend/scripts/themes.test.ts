import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import type { SourceFile } from "./fences";
import { findThemeViolations, readThemeSources, WINDOW_FILE } from "./themes";

const FRONTEND_ROOT = fileURLToPath(new URL("..", import.meta.url));

const BINDINGS: SourceFile = {
  path: "src/ipc/bindings.ts",
  text: `export type Other = "x";\n\nexport type Theme = "dark" | "light" | "zed-dark";\n`,
};

const DARK: SourceFile = {
  path: "src/style.css",
  text: [
    '@import "tailwindcss";',
    "",
    "@theme static {",
    "  --color-*: initial;",
    "  --font-sans: system-ui;",
    "  --radius-island: 10px;",
    "  --spacing-island: 5px;",
    "  --island-line: 0px;",
    "  --spacing-handle: 5px;",
    "  --color-window: #27252e;",
    "  --color-code: #c4c2ce;",
    "  --syntax-comment-style: normal;",
    "}",
    "",
  ].join("\n"),
};

const LIGHT: SourceFile = {
  path: "src/themes/light.css",
  text: [
    ':root[data-theme="light"] {',
    "  color-scheme: light;",
    "  --radius-island: 10px;",
    "  --spacing-island: 5px;",
    "  --island-line: 0px;",
    "  --color-window: #E9EAEE;",
    "  --color-code: #080808;",
    "  --syntax-comment-style: normal;",
    "}",
    "",
  ].join("\n"),
};

const ZED: SourceFile = {
  path: "src/themes/zed-dark.css",
  text: [
    "/* Zed 1.25.3 One Dark */",
    ':root[data-theme="zed-dark"] {',
    "  --radius-island: 0px; /* dock:1341 */",
    "  --spacing-island: 0px; /* dock:1341 */",
    "  --island-line: 1px; /* dock:1341 */",
    "  --color-window: #3b414d; /* one:18 background */",
    "  --color-code: #acb2be; /* one:57 editor.foreground */",
    "  --syntax-comment-style: italic; /* one:203 comment */",
    "}",
    "",
  ].join("\n"),
};

const ARMS = [
  "        Theme::Dark => BACKGROUND_DARK,",
  "        Theme::Light => BACKGROUND_LIGHT,",
  "        Theme::ZedDark => BACKGROUND_ZED_DARK,",
];

const CONSTANTS: readonly (readonly [string, string])[] = [
  ["BACKGROUND_DARK", "0x27, 0x25, 0x2e"],
  ["BACKGROUND_LIGHT", "0xe9, 0xea, 0xee"],
  ["BACKGROUND_ZED_DARK", "0x3b, 0x41, 0x4d"],
];

function window(
  constants: readonly (readonly [string, string])[] = CONSTANTS,
  arms: readonly string[] = ARMS,
): SourceFile {
  return {
    path: WINDOW_FILE,
    text: [
      ...constants.map(([name, rgb]) => `const ${name}: Color = Color(${rgb}, 0xff);`),
      "",
      "fn background(theme: Theme) -> Color {",
      "    match theme {",
      ...arms,
      "    }",
      "}",
      "",
      "fn other(theme: Theme) -> bool {",
      "    match theme {",
      "        Theme::Dark => BACKGROUND_LIGHT,",
      "    }",
      "}",
      "",
    ].join("\n"),
  };
}

function tree(...replaced: readonly SourceFile[]): SourceFile[] {
  const files = [BINDINGS, DARK, LIGHT, ZED, window()];
  const paths = new Set(replaced.map(({ path }) => path));
  return [...files.filter(({ path }) => !paths.has(path)), ...replaced];
}

function edited(file: SourceFile, from: string, to: string): SourceFile {
  return { path: file.path, text: file.text.replace(from, to) };
}

test("the real source tree has one complete block per theme and its own native background", () => {
  const sources = readThemeSources(FRONTEND_ROOT);

  expect(sources.map(({ path }) => path)).toContain(WINDOW_FILE);
  expect(sources.map(({ path }) => path)).toContain("src/themes/zed-light.css");
  expect(findThemeViolations(sources)).toEqual([]);
});

test("a tree with every block, token, source and background in step violates nothing", () => {
  expect(findThemeViolations(tree())).toEqual([]);
});

test("a theme name without its block is reported at the file it belongs in", () => {
  const files = tree().filter(({ path }) => path !== ZED.path);

  expect(findThemeViolations(files)).toEqual([
    { rule: "missing-block", file: "src/themes/zed-dark.css", line: 1, match: "zed-dark" },
    { rule: "window-background", file: WINDOW_FILE, line: 3, match: "BACKGROUND_ZED_DARK" },
  ]);
});

test("Dark's block is the @theme block of src/style.css", () => {
  const unthemed = { path: DARK.path, text: "@layer base {\n}\n" };

  expect(findThemeViolations(tree(unthemed))).toContainEqual({
    rule: "missing-block",
    file: "src/style.css",
    line: 1,
    match: "dark",
  });
});

test("a block without a theme name, in another theme's file or twice is an extra block", () => {
  const unknown = { path: "src/themes/nord.css", text: ':root[data-theme="nord"] {\n}\n' };
  const misplaced = { path: DARK.path, text: `${DARK.text}:root[data-theme="light"] {\n}\n` };
  const twice = { path: LIGHT.path, text: `${LIGHT.text}${LIGHT.text}` };

  expect(findThemeViolations(tree(unknown, misplaced, twice))).toEqual([
    { rule: "extra-block", file: "src/themes/nord.css", line: 1, match: "nord" },
    { rule: "extra-block", file: "src/style.css", line: 14, match: "light" },
    { rule: "extra-block", file: "src/themes/light.css", line: 10, match: "light" },
  ]);
});

test("a block must define exactly Dark's colour, shape and style variables", () => {
  const missing = edited(ZED, "  --color-code: #acb2be; /* one:57 editor.foreground */\n", "");
  const extra = edited(
    LIGHT,
    "  --color-code: #080808;",
    "  --color-code: #080808;\n  --color-extra: #123456;\n  --font-sans: serif;",
  );

  expect(findThemeViolations(tree(missing, extra))).toEqual([
    { rule: "missing-token", file: "src/themes/zed-dark.css", line: 2, match: "--color-code" },
    { rule: "extra-token", file: "src/themes/light.css", line: 8, match: "--color-extra" },
    { rule: "extra-token", file: "src/themes/light.css", line: 9, match: "--font-sans" },
  ]);
});

test("a style variable takes only its allowed words and a shape variable only whole pixels", () => {
  const styles = edited(LIGHT, "--syntax-comment-style: normal;", "--syntax-comment-style: bold;");
  const shape = edited(ZED, "--island-line: 1px;", "--island-line: 1.5px;");
  const dark = edited(DARK, "--radius-island: 10px;", "--radius-island: 1rem;");

  expect(findThemeViolations(tree(styles, shape, dark))).toEqual([
    {
      rule: "bad-value",
      file: "src/themes/light.css",
      line: 8,
      match: "--syntax-comment-style: bold",
    },
    { rule: "bad-value", file: "src/themes/zed-dark.css", line: 5, match: "--island-line: 1.5px" },
    { rule: "bad-value", file: "src/style.css", line: 6, match: "--radius-island: 1rem" },
  ]);
});

type Styles = { readonly weight: string; readonly line: string; readonly sourced: string };

function styled(file: SourceFile, { weight, line, sourced }: Styles): SourceFile {
  return edited(
    file,
    "--syntax-comment-style:",
    `--syntax-heading-weight: ${weight};${sourced}\n  --syntax-link-line: ${line};${sourced}\n  --syntax-comment-style:`,
  );
}

test("each allowed word passes for weight and line variables", () => {
  const words = ["normal", "bold"].flatMap((weight) =>
    ["none", "underline", "line-through"].map((line) => ({ weight, line })),
  );

  for (const { weight, line } of words) {
    const files = tree(
      styled(DARK, { weight, line, sourced: "" }),
      styled(LIGHT, { weight, line, sourced: "" }),
      styled(ZED, { weight, line, sourced: " /* one:383 */" }),
    );

    expect(findThemeViolations(files)).toEqual([]);
  }
});

test("every definition in an editor's theme ends with its source, yamt's own themes need none", () => {
  const unsourced = edited(ZED, "#acb2be; /* one:57 editor.foreground */", "#acb2be; /**/");
  const bare = edited(ZED, "#3b414d; /* one:18 background */", "#3b414d;");

  expect(findThemeViolations(tree(unsourced))).toEqual([
    { rule: "no-source", file: "src/themes/zed-dark.css", line: 7, match: "--color-code" },
  ]);
  expect(findThemeViolations(tree(bare))).toEqual([
    { rule: "no-source", file: "src/themes/zed-dark.css", line: 6, match: "--color-window" },
  ]);
});

test("each theme's native background equals its block's --color-window", () => {
  const different = window([
    ["BACKGROUND_DARK", "0x27, 0x25, 0x2e"],
    ["BACKGROUND_LIGHT", "0xe9, 0xea, 0xef"],
  ]);

  expect(findThemeViolations(tree(different))).toEqual([
    { rule: "window-background", file: WINDOW_FILE, line: 2, match: "BACKGROUND_LIGHT" },
    { rule: "window-background", file: WINDOW_FILE, line: 1, match: "BACKGROUND_ZED_DARK" },
  ]);
});

test("background() maps each theme to its own constant exactly once", () => {
  const swapped = window(CONSTANTS, [
    "        Theme::Dark => BACKGROUND_DARK,",
    "        Theme::Light => BACKGROUND_ZED_DARK,",
    "        Theme::ZedDark => BACKGROUND_LIGHT,",
    "        Theme::Dark => BACKGROUND_DARK,",
    "        Theme::Nord => BACKGROUND_DARK,",
  ]);
  const missing = window(CONSTANTS, ARMS.slice(0, 2));

  expect(findThemeViolations(tree(swapped))).toEqual([
    { rule: "window-arm", file: WINDOW_FILE, line: 8, match: "Theme::Light" },
    { rule: "window-arm", file: WINDOW_FILE, line: 9, match: "Theme::ZedDark" },
    { rule: "window-arm", file: WINDOW_FILE, line: 10, match: "Theme::Dark" },
    { rule: "window-arm", file: WINDOW_FILE, line: 11, match: "Theme::Nord" },
  ]);
  expect(findThemeViolations(tree(missing))).toEqual([
    { rule: "window-arm", file: WINDOW_FILE, line: 1, match: "Theme::ZedDark" },
  ]);
});

test("a window file without background() reports every theme's arm", () => {
  const none = { path: WINDOW_FILE, text: window().text.replace("fn background(", "fn shade(") };

  expect(findThemeViolations(tree(none)).map(({ match }) => match)).toEqual([
    "Theme::Dark",
    "Theme::Light",
    "Theme::ZedDark",
  ]);
});

function placeWindowFile(folder: string, text: string): void {
  mkdirSync(join(folder, "src-tauri/src"), { recursive: true });
  writeFileSync(join(folder, WINDOW_FILE), text);
}

function windowTextAbove(frontendRoot: string): string | undefined {
  return readThemeSources(frontendRoot).find(({ path }) => path === WINDOW_FILE)?.text;
}

test("readThemeSources reads the window file of the nearest ancestor, as from a mutation sandbox", () => {
  const root = mkdtempSync(join(tmpdir(), "yamt-themes-"));
  const frontend = join(root, "target/stryker-tmp/sandbox-1");
  try {
    mkdirSync(join(frontend, "src/themes"), { recursive: true });
    writeFileSync(join(frontend, "src/themes/zed-dark.css"), ZED.text);

    expect(readThemeSources(frontend).map(({ path }) => path)).toEqual(["src/themes/zed-dark.css"]);
    placeWindowFile(root, "// repository\n");
    expect(windowTextAbove(frontend)).toBe("// repository\n");
    placeWindowFile(join(root, "target"), "// nearer\n");
    expect(windowTextAbove(frontend)).toBe("// nearer\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

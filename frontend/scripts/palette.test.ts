import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import { findPaletteViolations, readPaletteSources, WINDOW_FILE } from "./palette";

const FRONTEND_ROOT = fileURLToPath(new URL("..", import.meta.url));

const PALETTE = {
  path: "src/style.css",
  text: `@theme static {\n  --color-*: initial;\n  --color-editor: #1e1f22;\n}\n`,
};

test("the real source tree has no palette violations, the native window colours included", () => {
  const sources = readPaletteSources(FRONTEND_ROOT);

  expect(sources.map(({ path }) => path)).toContain(WINDOW_FILE);
  expect(findPaletteViolations(sources)).toEqual([]);
});

const TWO_PALETTES = {
  path: "src/style.css",
  text: [
    "@theme static {",
    "  --color-*: initial;",
    "  --color-window: #26282c;",
    "  --color-editor: #1e1f22;",
    "}",
    "",
    ':root[data-theme="light"] {',
    "  color-scheme: light;",
    "  --color-window: #E9EAEE;",
    "  --color-editor: #ffffff;",
    "}",
    "",
  ].join("\n"),
};

function shell(dark: string, light: string): { path: string; text: string } {
  return {
    path: WINDOW_FILE,
    text: [
      "// `--color-window` in frontend/src/style.css, dark and light palettes.",
      `const BACKGROUND_DARK: Color = Color(${dark}, 0xff);`,
      `const BACKGROUND_LIGHT: Color = Color(${light}, 0xff);`,
      "",
    ].join("\n"),
  };
}

test("colour literals inside the light block are allowed", () => {
  expect(findPaletteViolations([TWO_PALETTES])).toEqual([]);
});

test("the light block must define exactly the dark block's colour tokens", () => {
  const palette = {
    path: "src/style.css",
    text: [
      "@theme static {",
      "  --color-window: #26282c;",
      "  --color-editor: #1e1f22;",
      "}",
      ':root[data-theme="light"] {',
      "  --color-window: #e9eaee;",
      "  --color-extra: #123456;",
      "}",
      "",
    ].join("\n"),
  };

  expect(findPaletteViolations([palette])).toEqual([
    { rule: "light-missing", file: "src/style.css", line: 5, match: "--color-editor" },
    { rule: "light-extra", file: "src/style.css", line: 7, match: "--color-extra" },
  ]);
});

test("a light block outside src/style.css exempts nothing", () => {
  const file = {
    path: "src/ui/extra.css",
    text: `:root[data-theme="light"] {\n  color: #fff;\n}\n`,
  };

  expect(findPaletteViolations([TWO_PALETTES, file])).toEqual([
    { rule: "literal", file: "src/ui/extra.css", line: 2, match: "#fff" },
  ]);
});

test("the native window backgrounds equal each palette's --color-window", () => {
  expect(
    findPaletteViolations([TWO_PALETTES, shell("0x26, 0x28, 0x2c", "0xe9, 0xea, 0xee")]),
  ).toEqual([]);
  expect(
    findPaletteViolations([TWO_PALETTES, shell("0x26, 0x28, 0x2d", "0xe9, 0xea, 0xee")]),
  ).toEqual([{ rule: "window-background", file: WINDOW_FILE, line: 2, match: "BACKGROUND_DARK" }]);
  expect(
    findPaletteViolations([TWO_PALETTES, shell("0x26, 0x28, 0x2c", "0xff, 0xff, 0xff")]),
  ).toEqual([{ rule: "window-background", file: WINDOW_FILE, line: 3, match: "BACKGROUND_LIGHT" }]);
});

test("a window file without one of the backgrounds is reported", () => {
  const missing = {
    path: WINDOW_FILE,
    text: "const BACKGROUND: Color = Color(0x26, 0x28, 0x2c, 0xff);\n",
  };

  expect(findPaletteViolations([TWO_PALETTES, missing])).toEqual([
    { rule: "window-background", file: WINDOW_FILE, line: 1, match: "BACKGROUND_DARK" },
    { rule: "window-background", file: WINDOW_FILE, line: 1, match: "BACKGROUND_LIGHT" },
  ]);
});

test("readPaletteSources reports ts, vue and css literals on disk and skips src/ipc/bindings.ts", () => {
  const root = mkdtempSync(join(tmpdir(), "yamt-palette-"));
  try {
    const probes: Record<string, string> = {
      "src/style.css": `@theme static {\n  --color-editor: #1e1f22;\n}\n\n@layer base {\n  body {\n    color: #ffffff;\n  }\n}\n`,
      "src/ui/Probe.vue": `<template>\n  <div class="bg-[#123456]"></div>\n</template>\n`,
      "src/ipc/bindings.ts": `export const shade = "#abcdef";\n`,
      "src/editor/theme.ts": `export const ink = "rgb(0 0 0)";\n`,
    };
    for (const [path, text] of Object.entries(probes)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }

    expect(findPaletteViolations(readPaletteSources(root))).toEqual([
      { rule: "literal", file: "src/editor/theme.ts", line: 1, match: "rgb(" },
      { rule: "literal", file: "src/ui/Probe.vue", line: 2, match: "#123456" },
      { rule: "literal", file: "src/style.css", line: 7, match: "#ffffff" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function windowTextAbove(frontendRoot: string): string | undefined {
  return readPaletteSources(frontendRoot).find(({ path }) => path === WINDOW_FILE)?.text;
}

function placeWindowFile(folder: string, text: string): void {
  mkdirSync(join(folder, "src-tauri/src"), { recursive: true });
  writeFileSync(join(folder, WINDOW_FILE), text);
}

test("readPaletteSources reads the window file of the nearest ancestor, as from a mutation sandbox", () => {
  const root = mkdtempSync(join(tmpdir(), "yamt-palette-"));
  const frontend = join(root, "target/stryker-tmp/sandbox-1");
  try {
    mkdirSync(join(frontend, "src"), { recursive: true });

    expect(windowTextAbove(frontend)).toBeUndefined();
    placeWindowFile(root, "// repository\n");
    expect(windowTextAbove(frontend)).toBe("// repository\n");
    placeWindowFile(join(root, "target"), "// nearer\n");
    expect(windowTextAbove(frontend)).toBe("// nearer\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rgb() in a ts theme object is a literal", () => {
  const file = {
    path: "src/editor/theme.ts",
    text: `export const theme = {\n  color: "rgb(0 0 0)",\n};\n`,
  };

  expect(findPaletteViolations([PALETTE, file])).toEqual([
    { rule: "literal", file: "src/editor/theme.ts", line: 2, match: "rgb(" },
  ]);
});

test("an upper-case OKLCH( is a literal", () => {
  const file = { path: "src/ui/tint.ts", text: `export const tint = "OKLCH(0.5 0.1 200)";\n` };

  expect(findPaletteViolations([PALETTE, file])).toEqual([
    { rule: "literal", file: "src/ui/tint.ts", line: 1, match: "OKLCH(" },
  ]);
});

test("an 8-digit hex colour is a literal", () => {
  const file = {
    path: "src/ui/App.vue",
    text: `<template>\n</template>\n<style>\np { color: #1e1f22cc; }\n</style>\n`,
  };

  expect(findPaletteViolations([PALETTE, file])).toEqual([
    { rule: "literal", file: "src/ui/App.vue", line: 4, match: "#1e1f22cc" },
  ]);
});

test("an upper-case hex colour is a literal", () => {
  const file = { path: "src/ui/extra.css", text: `p {\n  color: #ABCDEF;\n}\n` };

  expect(findPaletteViolations([PALETTE, file])).toEqual([
    { rule: "literal", file: "src/ui/extra.css", line: 2, match: "#ABCDEF" },
  ]);
});

test("var(--color-nope) in a ts file is an unknown token", () => {
  const file = { path: "src/editor/pane.ts", text: `\nconst caret = "var(--color-nope)";\n` };

  expect(findPaletteViolations([PALETTE, file])).toEqual([
    { rule: "unknown-token", file: "src/editor/pane.ts", line: 2, match: "--color-nope" },
  ]);
});

test("--color-nope in a vue style block is an unknown token", () => {
  const file = {
    path: "src/ui/FileList.vue",
    text: `<template>\n  <ul></ul>\n</template>\n<style>\nul {\n  --color-nope: var(--color-editor);\n}\n</style>\n`,
  };

  expect(findPaletteViolations([PALETTE, file])).toEqual([
    { rule: "unknown-token", file: "src/ui/FileList.vue", line: 6, match: "--color-nope" },
  ]);
});

test("var(--color-nope) inside @theme is an unknown token", () => {
  const palette = {
    path: "src/style.css",
    text: `@theme {\n  --color-editor: #1e1f22;\n  --color-fg: var(--color-nope);\n}\n`,
  };

  expect(findPaletteViolations([palette])).toEqual([
    { rule: "unknown-token", file: "src/style.css", line: 3, match: "--color-nope" },
  ]);
});

test("a nested block inside @theme does not close it early", () => {
  const palette = {
    path: "src/style.css",
    text: `@theme inline {\n  --color-editor: #1e1f22;\n  @keyframes x { to { opacity: 0; } }\n  --color-late: #abcabc;\n}\nhtml { color: #fff; background: var(--color-late); }\n`,
  };

  expect(findPaletteViolations([palette])).toEqual([
    { rule: "literal", file: "src/style.css", line: 6, match: "#fff" },
  ]);
});

test("a bare --color- mention is exempt inside @theme and unknown outside it", () => {
  const palette = {
    path: "src/style.css",
    text: `@theme static {\n  /* was --color-old */\n  --color-editor: #1e1f22;\n}\n`,
  };
  const file = { path: "src/ui/extra.css", text: `p {\n  /* was --color-old */\n}\n` };

  expect(findPaletteViolations([palette, file])).toEqual([
    { rule: "unknown-token", file: "src/ui/extra.css", line: 2, match: "--color-old" },
  ]);
});

test("an @theme block outside src/style.css does not exempt literals or define tokens", () => {
  const file = {
    path: "src/ui/extra.css",
    text: `@theme {\n  --color-extra: #abcd;\n}\n`,
  };

  expect(findPaletteViolations([PALETTE, file])).toEqual([
    { rule: "literal", file: "src/ui/extra.css", line: 2, match: "#abcd" },
    { rule: "unknown-token", file: "src/ui/extra.css", line: 2, match: "--color-extra" },
  ]);
});

test("hex digits of other lengths or followed by a word character are not colours", () => {
  const file = {
    path: "src/ui/ids.ts",
    text: `export const ids = ["#12", "#12345", "#1234567", "#abc-x", "#fffg", "1#abc"];\n`,
  };

  expect(findPaletteViolations([PALETTE, file])).toEqual([]);
});

test("palette-conforming sources violate nothing", () => {
  const files = [
    PALETTE,
    { path: "src/main.ts", text: `document.querySelector("#app");\n` },
    { path: "src/editor/pane.ts", text: `const bg = "var(--color-editor)";\n` },
    {
      path: "src/ui/App.vue",
      text: `<style>\np { color: color-mix(in srgb, var(--color-editor) 30%, transparent); }\n</style>\n`,
    },
    { path: "src/ui/notes.ts", text: `export const ref = "issue#123";\n` },
    { path: "src/ui/convert.ts", text: `export const x = parseRgb(toHsl(v));\n` },
  ];

  expect(findPaletteViolations(files)).toEqual([]);
});

import "../style.css";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import CSS_PROBE from "../../fixtures/themes/colour.css.txt?raw";
import { DEFAULT_KEYS, loadFixture, THEMES, type FileMergeData, type Theme } from "../ipc";
import { MergeController, type MergeHosts, type MergeOptions } from "./index";
import { found, mount, unmountAll } from "./paneHarness";

import STYLE from "../style.css?raw";
import ATOM_DARK from "../themes/atom-dark.css?raw";
import ATOM_LIGHT from "../themes/atom-light.css?raw";
import LIGHT from "../themes/light.css?raw";
import VSCODE_DARK from "../themes/vscode-dark.css?raw";
import VSCODE_LIGHT from "../themes/vscode-light.css?raw";
import WEBSTORM_DARK from "../themes/webstorm-dark.css?raw";
import WEBSTORM_LIGHT from "../themes/webstorm-light.css?raw";
import ZED_DARK from "../themes/zed-dark.css?raw";
import ZED_LIGHT from "../themes/zed-light.css?raw";

type Probe = { readonly needle: string; readonly colour: string };
type Fixture = { readonly path: string; readonly text: string; readonly probes: readonly Probe[] };
type Fonts = { readonly style?: string; readonly weight?: string; readonly line?: string };

const WIDTH = 1400;
const HEIGHT = 800;
const WAIT_MS = 5000;
const MINIMAP_EDGE_PX = 6;
const MINIMAP_CODE_PX = 120;
const CSS_COLOUR_LITERAL = present(
  /color: ([^;]+);/.exec(CSS_PROBE)?.[1],
  "colour in the CSS probe",
);

const CSS_TEXT: Readonly<Record<Theme, string>> = {
  dark: themeBlock(STYLE),
  light: LIGHT,
  "webstorm-dark": WEBSTORM_DARK,
  "webstorm-light": WEBSTORM_LIGHT,
  "vscode-dark": VSCODE_DARK,
  "vscode-light": VSCODE_LIGHT,
  "zed-dark": ZED_DARK,
  "zed-light": ZED_LIGHT,
  "atom-dark": ATOM_DARK,
  "atom-light": ATOM_LIGHT,
};

const FONTS: Readonly<Record<string, Fonts>> = {
  "--color-syntax-comment": { style: "--syntax-comment-style" },
  "--color-syntax-heading": { weight: "--syntax-heading-weight", style: "--syntax-heading-style" },
  "--color-syntax-emphasis": { style: "--syntax-emphasis-style" },
  "--color-syntax-strong": { weight: "--syntax-strong-weight" },
  "--color-syntax-strikethrough": { line: "--syntax-strikethrough-line" },
  "--color-syntax-link": { line: "--syntax-link-line", style: "--syntax-link-style" },
  "--color-syntax-url": { line: "--syntax-url-line", style: "--syntax-url-style" },
  "--color-syntax-function": { style: "--syntax-function-style" },
  "--color-syntax-quote": { style: "--syntax-quote-style" },
  "--color-syntax-content-separator": {
    weight: "--syntax-content-separator-weight",
    style: "--syntax-content-separator-style",
  },
};

const COLOUR_BEFORE_THE_TABLE: Readonly<Record<string, string>> = {
  "--color-syntax-keyword": "--color-syntax-keyword",
  "--color-syntax-control-keyword": "--color-syntax-keyword",
  "--color-syntax-definition-keyword": "--color-syntax-keyword",
  "--color-syntax-bool": "--color-syntax-keyword",
  "--color-syntax-null": "--color-syntax-keyword",
  "--color-syntax-self": "--color-syntax-keyword",
  "--color-syntax-string": "--color-syntax-string",
  "--color-syntax-character": "--color-syntax-string",
  "--color-syntax-number": "--color-syntax-number",
  "--color-syntax-unit": "--color-syntax-keyword",
  "--color-syntax-regexp": "--color-syntax-regexp",
  "--color-syntax-escape": "--color-syntax-keyword",
  "--color-syntax-comment": "--color-syntax-comment",
  "--color-syntax-function": "--color-syntax-function",
  "--color-syntax-method": "--color-syntax-function",
  "--color-syntax-property": "--color-syntax-property",
  "--color-syntax-property-definition": "--color-syntax-property",
  "--color-syntax-decorator": "--color-syntax-decorator",
  "--color-syntax-markup-mark": "--color-syntax-decorator",
  "--color-syntax-tag": "--color-syntax-tag",
  "--color-syntax-angle-bracket": "--color-syntax-tag",
  "--color-syntax-attribute": "--color-syntax-property",
  "--color-syntax-link": "--color-syntax-link",
  "--color-syntax-url": "--color-syntax-link",
};
const BOLD_BEFORE: Readonly<Record<string, true>> = {
  "--color-syntax-heading": true,
  "--color-syntax-strong": true,
};
const ITALIC_BEFORE: Readonly<Record<string, true>> = { "--color-syntax-emphasis": true };

const TSX: Fixture = {
  path: "src/probe.tsx",
  text: [
    'import { imported } from "./mod";',
    "@sealed",
    "class Widget extends Base {",
    "  readonly count: number;",
    "  build() {",
    '    return this.make(true, null, /ab+c/, `t${imported}`, "a\\n", 42, typeof other);',
    "  }",
    "}",
    "function compute() {}",
    "const total = (input) => input + holder.field;",
    "const item = { key: 1 };",
    'const view = <div title="t">x</div>;',
    "// a comment",
    "",
  ].join("\n"),
  probes: [
    { needle: "readonly", colour: "--color-syntax-keyword" },
    { needle: "typeof", colour: "--color-syntax-keyword" },
    { needle: "return", colour: "--color-syntax-control-keyword" },
    { needle: "import", colour: "--color-syntax-control-keyword" },
    { needle: "class", colour: "--color-syntax-definition-keyword" },
    { needle: "true", colour: "--color-syntax-bool" },
    { needle: "null", colour: "--color-syntax-null" },
    { needle: "this", colour: "--color-syntax-self" },
    { needle: '"./mod"', colour: "--color-syntax-string" },
    { needle: "42", colour: "--color-syntax-number" },
    { needle: "/ab+c/", colour: "--color-syntax-regexp" },
    { needle: "\\n", colour: "--color-syntax-escape" },
    { needle: "// a comment", colour: "--color-syntax-comment" },
    { needle: "sealed", colour: "--color-syntax-variable" },
    { needle: "total", colour: "--color-syntax-variable-definition" },
    { needle: "compute", colour: "--color-syntax-function" },
    { needle: "make", colour: "--color-syntax-method" },
    { needle: "field", colour: "--color-syntax-property" },
    { needle: "key", colour: "--color-syntax-property-definition" },
    { needle: "Widget", colour: "--color-syntax-type" },
    { needle: "+", colour: "--color-syntax-operator" },
    { needle: "=>", colour: "--color-syntax-arrow" },
    { needle: ";", colour: "--color-syntax-punctuation" },
    { needle: "${", colour: "--color-syntax-interpolation" },
    { needle: "@", colour: "--color-syntax-decorator" },
    { needle: "div", colour: "--color-syntax-tag" },
    { needle: "<", colour: "--color-syntax-angle-bracket" },
    { needle: "title", colour: "--color-syntax-attribute" },
  ],
};

const FIXTURES: readonly Fixture[] = [
  TSX,
  {
    path: "src/probe.css",
    text: CSS_PROBE,
    probes: [
      { needle: "px", colour: "--color-syntax-unit" },
      { needle: CSS_COLOUR_LITERAL, colour: "--color-syntax-colour-literal" },
    ],
  },
  {
    path: "src/lib.rs",
    text: "fn f() -> char { 'q' }\n",
    probes: [{ needle: "'q'", colour: "--color-syntax-character" }],
  },
  {
    path: "notes.md",
    text: "# Title\n\n> quoted\n\n- item\n\n*em* **bold** `mono` [label](http://x.y)\n\n---\n",
    probes: [
      { needle: "-", colour: "--color-syntax-markup-mark" },
      { needle: " Title", colour: "--color-syntax-heading" },
      { needle: "em", colour: "--color-syntax-emphasis" },
      { needle: "bold", colour: "--color-syntax-strong" },
      { needle: " quoted", colour: "--color-syntax-quote" },
      { needle: "---", colour: "--color-syntax-content-separator" },
      { needle: "mono", colour: "--color-syntax-monospace" },
      { needle: "label", colour: "--color-syntax-link" },
      { needle: "http://x.y", colour: "--color-syntax-url" },
    ],
  },
];

const IN_EMPHASIS: Fixture = {
  path: "nested.md",
  text: "*[inner](u)* and [*outer*](u) and *<http://x.y>*\n",
  probes: [
    { needle: "inner", colour: "--color-syntax-link" },
    { needle: "outer", colour: "--color-syntax-link" },
    { needle: "http://x.y", colour: "--color-syntax-url" },
  ],
};

const OPTIONS: MergeOptions = {
  readOnly: false,
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  collapsed: false,
  minimap: false,
  servers: null,
};

const controllers: MergeController[] = [];

function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`no ${what}`);
  }
  return value;
}

function themeBlock(css: string): string {
  const start = css.indexOf("@theme static {");
  return css.slice(start, css.indexOf("\n}", start));
}

function variables(css: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value?.trim()]),
  );
}

function themes(): Theme[] {
  return Object.keys(THEMES).filter((name): name is Theme => Object.hasOwn(THEMES, name));
}

function computed(property: string, value: string): string {
  const probe = document.createElement("div");
  document.body.append(probe);
  probe.style.setProperty(property, value);
  const result = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return result;
}

function valueOf(values: Readonly<Record<string, string>>, name: string): string {
  const value = values[name];
  if (value === undefined) {
    throw new Error(`no ${name}`);
  }
  return value;
}

async function data(fixture: Fixture, conflict: boolean): Promise<FileMergeData> {
  const lines = fixture.text.split("\n").length - 1;
  const line = { start: lines, len: 1 };
  const name = fixture.path.slice(fixture.path.lastIndexOf("/") + 1);
  return loadFixture(fixture.path, {
    [`${name}.json`]: {
      path: fixture.path,
      deleted: null,
      middle: { kind: "Stages", text: `${fixture.text}${conflict ? "const a = old;\n" : ""}` },
      local: `${fixture.text}${conflict ? "const a = mine;\n" : ""}`,
      remote: `${fixture.text}${conflict ? "const a = theirs;\n" : ""}`,
      eol: "Lf",
      disk_version: 0,
      chunks: conflict
        ? [
            {
              chunk: { id: 0, kind: "Conflict", base: line, local: line, remote: line },
              middle: line,
              words: {
                chunk: 0,
                local: { changed: [{ line: lines, start: 10, len: 4 }], removals: [] },
                remote: { changed: [{ line: lines, start: 10, len: 6 }], removals: [] },
              },
              waiting: {
                kind: "Markers",
                open: "<<<<<<< ours",
                first: "local",
                between: ["======="],
                close: ">>>>>>> theirs",
              },
            },
          ]
        : [],
    },
  });
}

function spanOf(host: HTMLElement, needle: string): HTMLElement | null {
  const content = host.querySelector(".cm-content");
  if (content === null) {
    return null;
  }
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (node.textContent === needle && parent !== null && !parent.classList.contains("cm-line")) {
      return parent;
    }
  }
  return null;
}

async function opened(fixture: Fixture, options: MergeOptions): Promise<MergeHosts> {
  const hosts = mount();
  controllers.push(new MergeController(await data(fixture, fixture === TSX), hosts, options));
  await vi.waitFor(
    () => fixture.probes.map(({ needle }) => found(spanOf(hosts.center, needle), needle)),
    { timeout: WAIT_MS },
  );
  return hosts;
}

function useTheme(theme: Theme): void {
  document.documentElement.dataset["theme"] = theme;
  for (const controller of controllers) {
    controller.setPreferences({ theme, keys: DEFAULT_KEYS });
  }
}

function spanLook(span: HTMLElement): readonly string[] {
  const style = getComputedStyle(span);
  return [style.color, style.fontStyle, style.fontWeight, style.textDecorationLine];
}

function expectedLook(
  values: Readonly<Record<string, string>>,
  colour: string,
  fonts: Fonts = FONTS[colour] ?? {},
): readonly string[] {
  function own(variable: string | undefined, otherwise: string): string {
    return variable === undefined ? otherwise : valueOf(values, variable);
  }
  return [
    computed("color", valueOf(values, colour)),
    computed("font-style", own(fonts.style, "normal")),
    computed("font-weight", own(fonts.weight, "normal")),
    computed("text-decoration-line", own(fonts.line, "none")),
  ];
}

function lookInEmphasis(
  values: Readonly<Record<string, string>>,
  colour: string,
): readonly string[] {
  return expectedLook(values, colour, { ...FONTS[colour], ...FONTS["--color-syntax-emphasis"] });
}

function shownLooks(fixture: Fixture, hosts: MergeHosts): readonly (readonly string[])[] {
  return fixture.probes.map(({ needle }) => spanLook(found(spanOf(hosts.center, needle), needle)));
}

function lookBefore(values: Readonly<Record<string, string>>, colour: string): readonly string[] {
  return [
    computed("color", valueOf(values, COLOUR_BEFORE_THE_TABLE[colour] ?? "--color-code")),
    computed("font-style", ITALIC_BEFORE[colour] === true ? "italic" : "normal"),
    computed("font-weight", BOLD_BEFORE[colour] === true ? "bold" : "normal"),
    computed("text-decoration-line", "none"),
  ];
}

function minimapPixels(hosts: MergeHosts): readonly number[] {
  const canvas = found(hosts.right.querySelector<HTMLCanvasElement>(".minimap > canvas"), "canvas");
  const context = present(canvas.getContext("2d"), "context");
  if (canvas.height === 0) {
    return [];
  }
  return [...context.getImageData(MINIMAP_EDGE_PX, 0, MINIMAP_CODE_PX, canvas.height).data];
}

beforeEach(async () => {
  await page.viewport(WIDTH, HEIGHT);
});

afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.destroy();
  }
  unmountAll();
  delete document.documentElement.dataset["theme"];
});

test("every theme's panel, gutter, code, syntax spans, band and word mark show the values in its CSS", async () => {
  const hosts = await Promise.all(FIXTURES.map((fixture) => opened(fixture, OPTIONS)));
  const nested = await opened(IN_EMPHASIS, OPTIONS);
  const [tsx] = hosts;
  const merge = present(tsx, "tsx hosts");

  for (const theme of themes()) {
    useTheme(theme);
    const values = variables(CSS_TEXT[theme]);
    const editor = found(merge.center.querySelector<HTMLElement>(".cm-editor"), "editor");
    const gutters = found(merge.center.querySelector<HTMLElement>(".cm-gutters"), "gutters");
    const band = found(merge.strips[0].querySelector("path.chunk-band.chunk-conflict"), "band");
    const word = found(merge.left.querySelector<HTMLElement>(".chunk-word-conflict"), "word");
    const shown = FIXTURES.flatMap((fixture, index) =>
      fixture.probes.map(({ needle, colour }) => [
        theme,
        colour,
        spanLook(found(spanOf(present(hosts[index], "hosts").center, needle), needle)),
      ]),
    );

    expect([
      getComputedStyle(editor).backgroundColor,
      getComputedStyle(gutters).backgroundColor,
      getComputedStyle(editor).color,
      getComputedStyle(band).fill,
      getComputedStyle(word).backgroundColor,
    ]).toEqual([
      computed("background-color", valueOf(values, "--color-panel")),
      computed("background-color", valueOf(values, "--color-panel")),
      computed("color", valueOf(values, "--color-code")),
      computed("color", valueOf(values, "--color-chunk-conflict")),
      computed("background-color", valueOf(values, "--color-chunk-conflict-word")),
    ]);
    expect(shown).toEqual(
      FIXTURES.flatMap((fixture) =>
        fixture.probes.map(({ colour }) => [theme, colour, expectedLook(values, colour)]),
      ),
    );
    expect([theme, shownLooks(IN_EMPHASIS, nested)]).toEqual([
      theme,
      IN_EMPHASIS.probes.map(({ colour }) => lookInEmphasis(values, colour)),
    ]);
  }
});

test("yamt Dark and Light colour and style every probed word as before the 39-token table", async () => {
  const hosts = await Promise.all(FIXTURES.map((fixture) => opened(fixture, OPTIONS)));
  const nested = await opened(IN_EMPHASIS, OPTIONS);

  const yamtThemes: readonly Theme[] = ["dark", "light"];
  const shown = yamtThemes.flatMap((theme) => {
    useTheme(theme);
    return FIXTURES.flatMap((fixture, index) =>
      fixture.probes.map(({ needle, colour }) => [
        theme,
        colour,
        spanLook(found(spanOf(present(hosts[index], "hosts").center, needle), needle)),
      ]),
    );
  });

  expect(shown).toEqual(
    yamtThemes.flatMap((theme) =>
      FIXTURES.flatMap((fixture) =>
        fixture.probes.map(({ colour }) => [
          theme,
          colour,
          lookBefore(variables(CSS_TEXT[theme]), colour),
        ]),
      ),
    ),
  );
  expect(
    yamtThemes.map((theme) => {
      useTheme(theme);
      return [theme, shownLooks(IN_EMPHASIS, nested).map(([, style]) => style)];
    }),
  ).toEqual([
    ["dark", ["italic", "italic", "italic"]],
    ["light", ["italic", "italic", "italic"]],
  ]);
});

test("with the minimap shown, a switch between two dark themes repaints its code pixels", async () => {
  const hosts = await opened(TSX, { ...OPTIONS, minimap: true });
  const painted = await vi.waitFor(
    () => {
      const pixels = minimapPixels(hosts);
      expect(pixels.some((channel, index) => index % 4 === 3 && channel > 0)).toBe(true);
      return pixels;
    },
    { timeout: WAIT_MS },
  );

  useTheme("vscode-dark");

  await vi.waitFor(
    () => {
      expect(minimapPixels(hosts)).not.toEqual(painted);
    },
    { timeout: WAIT_MS },
  );
});

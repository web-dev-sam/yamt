import { expect, test } from "vitest";

import type { Theme } from "./domain";
import { THEMES, themeKind, themeOf, themeRows } from "./themes";

const NAMES: readonly Theme[] = [
  "dark",
  "light",
  "webstorm-dark",
  "webstorm-light",
  "vscode-dark",
  "vscode-light",
  "zed-dark",
  "zed-light",
  "atom-dark",
  "atom-light",
];

test("themeOf keeps each of the ten names and reads anything else as yamt Dark", () => {
  expect(NAMES.map(themeOf)).toEqual(NAMES);
  expect([undefined, "", "Dark", "zed", "light "].map(themeOf)).toEqual([
    "dark",
    "dark",
    "dark",
    "dark",
    "dark",
  ]);
});

test("themeKind is light for the five light themes and dark for the other five", () => {
  expect(Object.fromEntries(NAMES.map((name) => [name, themeKind(name)]))).toEqual({
    dark: "dark",
    light: "light",
    "webstorm-dark": "dark",
    "webstorm-light": "light",
    "vscode-dark": "dark",
    "vscode-light": "light",
    "zed-dark": "dark",
    "zed-light": "light",
    "atom-dark": "dark",
    "atom-light": "light",
  });
});

test("themeRows lists five editors in order, each its dark then its light, with the editors' words", () => {
  expect(themeRows()).toEqual([
    {
      group: "yamt",
      themes: [
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
      ],
    },
    {
      group: "WebStorm",
      themes: [
        { value: "webstorm-dark", label: "Islands Dark" },
        { value: "webstorm-light", label: "Islands Light" },
      ],
    },
    {
      group: "VS Code",
      themes: [
        { value: "vscode-dark", label: "Dark 2026" },
        { value: "vscode-light", label: "Light 2026" },
      ],
    },
    {
      group: "Zed",
      themes: [
        { value: "zed-dark", label: "One Dark" },
        { value: "zed-light", label: "One Light" },
      ],
    },
    {
      group: "Atom",
      themes: [
        { value: "atom-dark", label: "One Dark" },
        { value: "atom-light", label: "One Light" },
      ],
    },
  ]);
  expect(Object.keys(THEMES).toSorted()).toEqual(NAMES.toSorted());
});

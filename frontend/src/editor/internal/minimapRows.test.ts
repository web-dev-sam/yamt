import { EditorState } from "@codemirror/state";
import { expect, test } from "vitest";

import { languageOf } from "./language";
import { readLook, rowColours, waveRowsOf } from "./minimapRows";

const CODE = 0;
const KEYWORD = 1;
const STRING = 2;
const NUMBER = 3;

async function typescript(text: string): Promise<EditorState> {
  const description = languageOf("a.ts");
  if (description === null) {
    throw new Error("no language for a.ts");
  }
  const { language } = await description.load();
  return EditorState.create({ doc: text, extensions: language });
}

test("a row's colours are the palette index of each character's syntax token, from the row's start", async () => {
  const state = await typescript("const x = 1;\nlet y = 'a';\n");
  const second = state.doc.line(2);
  const first = state.doc.line(1);

  expect([...rowColours(state, second.from, second.to)]).toEqual([
    KEYWORD,
    KEYWORD,
    KEYWORD,
    CODE,
    CODE,
    CODE,
    CODE,
    CODE,
    STRING,
    STRING,
    STRING,
    CODE,
  ]);
  expect([...rowColours(state, first.from + 6, first.to)]).toEqual([
    CODE,
    CODE,
    CODE,
    CODE,
    NUMBER,
    CODE,
  ]);
});

test("text no grammar colours is drawn in the code colour", () => {
  const state = EditorState.create({ doc: "const x = 1;" });

  expect([...rowColours(state, 0, state.doc.length)]).toEqual(
    Array.from({ length: 12 }, () => CODE),
  );
});

function hexOf({ r, g, b }: { r: number; g: number; b: number }): string {
  return ["#", ...[r, g, b].map((channel) => channel.toString(16).padStart(2, "0"))].join("");
}

test("the look reads each token once: code first, a missing token in the code colour, edges as given", () => {
  const code = { r: 196, g: 194, b: 206 };
  const keyword = { r: 224, g: 152, b: 107 };
  const wave = { r: 86, g: 83, b: 98 };
  const conflict = hexOf({ r: 129, g: 80, b: 190 });
  const error = hexOf({ r: 246, g: 107, b: 113 });
  const values: Readonly<Record<string, string>> = {
    "--color-code": ` ${hexOf(code)}`,
    "--color-syntax-keyword": hexOf(keyword),
    "--color-diff-wave": hexOf(wave),
    "--color-mark-conflict": ` ${conflict}`,
    "--color-problem-error": error,
    "--color-problem-warning": "not a colour",
  };
  const style = { getPropertyValue: (name: string): string => values[name] ?? "" };
  const look = readLook(style, true, 2);

  expect(look.glyphs.scale).toBe(2);
  expect(look.glyphs.light).toBe(true);
  expect(look.glyphs.palette.slice(0, 3)).toEqual([code, keyword, code]);
  expect(look.wave).toEqual(wave);
  expect(look.edges).toEqual({
    inserted: hexOf(code),
    modified: hexOf(code),
    deleted: hexOf(code),
    conflict,
    error,
    warning: hexOf(code),
  });
});

test("a collapsed run's row is the row of its wave line's top in the Result", () => {
  const waves = [
    { left: 0, center: 40, right: 0 },
    { left: 100, center: null, right: 100 },
    { left: 200, center: 2000, right: 220 },
  ];

  expect([...waveRowsOf(waves)]).toEqual([3, 101]);
});

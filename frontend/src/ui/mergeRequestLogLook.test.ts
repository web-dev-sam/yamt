import { expect, test } from "vitest";

import type { AnsiColour, LogStyle } from "../mergeRequests";
import { runClasses } from "./mergeRequestLogLook";

const PLAIN: LogStyle = {
  foreground: null,
  background: null,
  bold: false,
  italic: false,
  underline: false,
  struck: false,
};

const COLOURS: readonly { readonly colour: AnsiColour; readonly token: string }[] = [
  { colour: "black", token: "black" },
  { colour: "red", token: "red" },
  { colour: "green", token: "green" },
  { colour: "yellow", token: "yellow" },
  { colour: "blue", token: "blue" },
  { colour: "magenta", token: "magenta" },
  { colour: "cyan", token: "cyan" },
  { colour: "white", token: "white" },
  { colour: "brightBlack", token: "bright-black" },
  { colour: "brightRed", token: "bright-red" },
  { colour: "brightGreen", token: "bright-green" },
  { colour: "brightYellow", token: "bright-yellow" },
  { colour: "brightBlue", token: "bright-blue" },
  { colour: "brightMagenta", token: "bright-magenta" },
  { colour: "brightCyan", token: "bright-cyan" },
  { colour: "brightWhite", token: "bright-white" },
];

test("the_plain_style_has_no_class", () => {
  expect(runClasses(PLAIN)).toBe("");
});

test.each(COLOURS)("every_colour_has_its_class_both_ways: $colour", ({ colour, token }) => {
  expect(runClasses({ ...PLAIN, foreground: colour })).toBe(`text-ansi-${token}`);
  expect(runClasses({ ...PLAIN, background: colour })).toBe(`bg-ansi-${token}`);
  expect(runClasses({ ...PLAIN, foreground: colour, background: colour })).toBe(
    `text-ansi-${token} bg-ansi-${token}`,
  );
});

test("every colour is tested once", () => {
  expect(new Set(COLOURS.map(({ colour }) => colour)).size).toBe(16);
});

test("bold, italic, underline and strike each have their class", () => {
  expect(runClasses({ ...PLAIN, bold: true })).toBe("font-bold");
  expect(runClasses({ ...PLAIN, italic: true })).toBe("italic");
  expect(runClasses({ ...PLAIN, underline: true })).toBe("underline");
  expect(runClasses({ ...PLAIN, struck: true })).toBe("line-through");
});

test("underline_and_strike_together_keep_both_lines", () => {
  expect(runClasses({ ...PLAIN, underline: true, struck: true })).toBe(
    "[text-decoration-line:underline_line-through]",
  );
});

test("every part together, in one order", () => {
  expect(
    runClasses({
      foreground: "brightRed",
      background: "blue",
      bold: true,
      italic: true,
      underline: true,
      struck: false,
    }),
  ).toBe("text-ansi-bright-red bg-ansi-blue font-bold italic underline");
});

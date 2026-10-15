import { Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { barPlace, shownRemoval } from "./removalText";

test("a bar's place on its line: start, end, inside, or an empty line", () => {
  const doc = Text.of(["ab", "", "cd"]);
  const first = doc.line(1);

  expect([0, 1, 2].map((pos) => barPlace(first, pos))).toEqual(["lineStart", "inside", "lineEnd"]);
  expect(barPlace(doc.line(2), 3)).toBe("emptyLine");
});

test("whole lines removed before a bar at column 0 lose their last line break, and only that one", () => {
  expect(shownRemoval("\tif (a >= 3.3) {\n", "lineStart")).toEqual({
    kind: "code",
    text: "\tif (a >= 3.3) {",
  });
  expect(shownRemoval("a();\n\nb();\n\n", "lineStart").text).toBe("a();\n\nb();\n");
  expect(shownRemoval("\nb();\n", "lineStart").text).toBe("\nb();");
});

test("whole lines removed after a bar at a line end lose their first line break, and only that one", () => {
  expect(shownRemoval("\n\t\t}", "lineEnd")).toEqual({ kind: "code", text: "\t\t}" });
  expect(shownRemoval("\n\nb();\n", "lineEnd").text).toBe("\nb();\n");
});

test("a bar on an empty line drops one joining line break, the trailing one first, and keeps a blank line inside", () => {
  expect(shownRemoval("a(1);\n\nb(1);", "emptyLine").text).toBe("a(1);\n\nb(1);");
  expect(shownRemoval("\na(1);", "emptyLine").text).toBe("a(1);");
  expect(shownRemoval("a(1);\n", "emptyLine").text).toBe("a(1);");
  expect(shownRemoval("\na(1);\n", "emptyLine").text).toBe("\na(1);");
});

test("text removed inside a line, or across lines without a join, is shown as it is", () => {
  expect(shownRemoval("\nb, ", "inside").text).toBe("\nb, ");
  expect(shownRemoval("b, \n", "inside").text).toBe("b, \n");
  expect(shownRemoval("if (ok) {\n\t", "lineStart")).toEqual({
    kind: "code",
    text: "if (ok) {\n\t",
  });
});

test("whitespace alone is shown as marks, line breaks included, so the tooltip is never empty", () => {
  expect(shownRemoval("\t", "lineStart")).toEqual({ kind: "whitespace", text: "→" });
  expect(shownRemoval("\n", "lineEnd")).toEqual({ kind: "whitespace", text: "↵" });
  expect(shownRemoval("  \t\n", "lineStart")).toEqual({ kind: "whitespace", text: "··→↵" });
});

test("text with anything visible keeps its whitespace unmarked", () => {
  expect(shownRemoval(" \tx ", "inside")).toEqual({ kind: "code", text: " \tx " });
});

import { expect, test } from "vitest";

import { formatJson } from "./formatJson";

const PRETTY = `{
  "name": "yamt",
  "tags": [
    "merge",
    true,
    null
  ],
  "empty": {},
  "none": [],
  "nested": {
    "deep": [
      -1.5e3,
      {
        "x": "y"
      }
    ]
  }
}
`;

test("formatJson: the same data minified and in an odd layout formats to the same text (catches ':' written without its space)", () => {
  const minified =
    '{"name":"yamt","tags":["merge",true,null],"empty":{},"none":[],"nested":{"deep":[-1.5e3,{"x":"y"}]}}\n';
  const odd = `  {"name"  :"yamt",
"tags":[ "merge" ,
 true,null   ],"empty":{
 },  "none" : [
 ],
     "nested":{"deep":[-1.5e3,{"x"
 :"y"}]}}

`;

  expect(formatJson(minified)).toEqual({ kind: "formatted", text: PRETTY });
  expect(formatJson(odd)).toEqual({ kind: "formatted", text: PRETTY });
});

test("formatJson: keys keep their order and numbers keep their text (catches JSON.stringify(JSON.parse(text), null, 2))", () => {
  expect(formatJson('{"b":1,"2":0,"big":12345678901234567890,"e":1.0e+10}')).toEqual({
    kind: "formatted",
    text: '{\n  "b": 1,\n  "2": 0,\n  "big": 12345678901234567890,\n  "e": 1.0e+10\n}',
  });
});

test("formatJson: a missing comma names the line of the token after it (catches line breaks before the token not counted)", () => {
  expect(formatJson('{\n  "a": 1\n  "b": 2\n}\n')).toEqual({
    kind: "failed",
    message: "Expected ',' or '}'",
    line: 3,
  });
  expect(formatJson("[\n\n  1\n  2]")).toEqual({
    kind: "failed",
    message: "Expected ',' or ']'",
    line: 4,
  });
});

test("formatJson: the final line break is kept, and so is its absence (catches always appending one)", () => {
  expect(formatJson("[1,2]\n")).toEqual({ kind: "formatted", text: "[\n  1,\n  2\n]\n" });
  expect(formatJson("[1,2]  \n \n")).toEqual({ kind: "formatted", text: "[\n  1,\n  2\n]\n" });
  expect(formatJson("[1,2]")).toEqual({ kind: "formatted", text: "[\n  1,\n  2\n]" });
  expect(formatJson("[1,2]  ")).toEqual({ kind: "formatted", text: "[\n  1,\n  2\n]" });
});

test("formatJson: empty blocks stay compact, also with whitespace inside (catches a line break inside them)", () => {
  expect(formatJson('{ "a": { }, "b": [\n] }')).toEqual({
    kind: "formatted",
    text: '{\n  "a": {},\n  "b": []\n}',
  });
  expect(formatJson("[]")).toEqual({ kind: "unchanged" });
});

test("formatJson: a string with escapes is one token, kept as written (catches the string scan ignoring backslashes)", () => {
  expect(formatJson('{"a\\"b":"c\\\\","u":"\\u00e9\\/"}')).toEqual({
    kind: "formatted",
    text: '{\n  "a\\"b": "c\\\\",\n  "u": "\\u00e9\\/"\n}',
  });
});

test("formatJson: strings with a raw control character, a bad escape, or no end fail", () => {
  expect(formatJson('["a\tb"]')).toEqual({
    kind: "failed",
    message: "Control character in a string",
    line: 1,
  });
  expect(formatJson('\n["a\\x"]')).toEqual({
    kind: "failed",
    message: "Invalid escape in a string",
    line: 2,
  });
  expect(formatJson('["a\\u12"]')).toEqual({
    kind: "failed",
    message: "Invalid escape in a string",
    line: 1,
  });
  expect(formatJson('["abc')).toEqual({ kind: "failed", message: "Unterminated string", line: 1 });
});

test("formatJson: numbers follow the JSON grammar", () => {
  expect(formatJson("[-0, 0.5, 1E-7]")).toEqual({
    kind: "formatted",
    text: "[\n  -0,\n  0.5,\n  1E-7\n]",
  });
  expect(formatJson("[01]")).toEqual({ kind: "failed", message: "Expected ',' or ']'", line: 1 });
  expect(formatJson("[1.]")).toEqual({ kind: "failed", message: "Expected ',' or ']'", line: 1 });
  expect(formatJson("[-]")).toEqual({ kind: "failed", message: "Expected a value", line: 1 });
  expect(formatJson("[+1]")).toEqual({ kind: "failed", message: "Expected a value", line: 1 });
});

test("formatJson: objects need string keys and a colon, arrays need values", () => {
  expect(formatJson("{a:1}")).toEqual({
    kind: "failed",
    message: "Expected a string key",
    line: 1,
  });
  expect(formatJson('{"a" 1}')).toEqual({ kind: "failed", message: "Expected ':'", line: 1 });
  expect(formatJson('{"a":1,}')).toEqual({
    kind: "failed",
    message: "Expected a string key",
    line: 1,
  });
  expect(formatJson("[1,]")).toEqual({ kind: "failed", message: "Expected a value", line: 1 });
  expect(formatJson("[1")).toEqual({ kind: "failed", message: "Expected ',' or ']'", line: 1 });
});

test("formatJson: text after the root value fails (catches stopping after the root)", () => {
  expect(formatJson('{"a":1}\n{"b":2}')).toEqual({
    kind: "failed",
    message: "Unexpected text after the JSON value",
    line: 2,
  });
  expect(formatJson("1 2")).toEqual({
    kind: "failed",
    message: "Unexpected text after the JSON value",
    line: 1,
  });
});

test("formatJson: already formatted text is unchanged (catches always answering formatted)", () => {
  expect(formatJson(PRETTY)).toEqual({ kind: "unchanged" });
  expect(formatJson('"text"')).toEqual({ kind: "unchanged" });
});

test("formatJson: empty and whitespace-only text is unchanged", () => {
  expect(formatJson("")).toEqual({ kind: "unchanged" });
  expect(formatJson(" \n\t\n ")).toEqual({ kind: "unchanged" });
});

test("formatJson: 100,000 nested arrays are scanned without throwing (catches a recursive descent)", () => {
  const depth = 100_000;
  const unclosed = "[".repeat(depth) + "]".repeat(depth - 1);

  expect(formatJson(unclosed)).toEqual({ kind: "failed", message: "Expected ',' or ']'", line: 1 });
});

test("formatJson: valid input nested past the output cap fails instead of throwing (catches the indent not counted in the output length)", () => {
  for (const depth of [6_000, 32_768]) {
    const result = formatJson("[".repeat(depth) + "]".repeat(depth));

    expect(result.kind === "formatted" ? result.text.length : result).toEqual({
      kind: "failed",
      message: "The formatted text is too long",
      line: 1,
    });
  }
});

test("formatJson: a leading byte order mark is kept and the scan starts after it (catches the mark handed to the scan)", () => {
  expect(formatJson('\uFEFF {"a":[1]}\n')).toEqual({
    kind: "formatted",
    text: '\uFEFF{\n  "a": [\n    1\n  ]\n}\n',
  });
  expect(formatJson('\uFEFF{\n  "a": 1\n}')).toEqual({ kind: "unchanged" });
});

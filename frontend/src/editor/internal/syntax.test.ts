import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { highlightTree, tags, type Tag } from "@lezer/highlight";
import { expect, test } from "vitest";

import { languageOf } from "./language";
import { rowColours } from "./minimapRows";
import { paletteHighlight, SYNTAX_COLOURS, syntaxColourClasses } from "./syntax";

const PARSE_BUDGET_MS = 5000;
const COLOUR = /(?:^|[{ ])color: var\(([^)]+)\);/;

function rules(): string[] {
  return paletteHighlight.module?.getRules().split("\n") ?? [];
}

function ruleOf(tag: Tag): string | null {
  const classes = paletteHighlight.style([tag]) ?? "";
  const rule = rules().find((line) => line.startsWith(`.${classes} {`));
  return rule === undefined ? null : rule.slice(rule.indexOf("{") + 1, -1).trim();
}

function colourOfRule(tag: Tag): string | null {
  return COLOUR.exec(ruleOf(tag) ?? "")?.[1] ?? null;
}

async function loaded(path: string, text: string): Promise<EditorState> {
  const description = languageOf(path);
  if (description === null) {
    throw new Error(`no language for ${path}`);
  }
  const { language } = await description.load();
  const state = EditorState.create({ doc: text, extensions: language });
  ensureSyntaxTree(state, state.doc.length, PARSE_BUDGET_MS);
  return state;
}

function tokenAt(state: EditorState, needle: string): string | null {
  const pos = state.doc.toString().indexOf(needle);
  expect(pos, needle).toBeGreaterThanOrEqual(0);
  let found: string | null = null;
  highlightTree(
    syntaxTree(state),
    syntaxColourClasses,
    (from, to, classes) => {
      if (from <= pos && pos < to) {
        found = classes;
      }
    },
    pos,
    pos + 1,
  );
  return found;
}

const PROBED: readonly (readonly [string, Tag, string | null])[] = [
  ["keyword", tags.keyword, "--color-syntax-keyword"],
  ["modifier", tags.modifier, "--color-syntax-keyword"],
  ["operatorKeyword", tags.operatorKeyword, "--color-syntax-keyword"],
  ["controlKeyword", tags.controlKeyword, "--color-syntax-control-keyword"],
  ["moduleKeyword", tags.moduleKeyword, "--color-syntax-control-keyword"],
  ["definitionKeyword", tags.definitionKeyword, "--color-syntax-definition-keyword"],
  ["bool", tags.bool, "--color-syntax-bool"],
  ["null", tags.null, "--color-syntax-null"],
  ["self", tags.self, "--color-syntax-self"],
  ["atom", tags.atom, "--color-syntax-self"],
  ["string", tags.string, "--color-syntax-string"],
  ["special(string)", tags.special(tags.string), "--color-syntax-string"],
  ["attributeValue", tags.attributeValue, "--color-syntax-string"],
  ["docString", tags.docString, "--color-syntax-string"],
  ["character", tags.character, "--color-syntax-character"],
  ["number", tags.number, "--color-syntax-number"],
  ["integer", tags.integer, "--color-syntax-number"],
  ["unit", tags.unit, "--color-syntax-unit"],
  ["color", tags.color, "--color-syntax-colour-literal"],
  ["regexp", tags.regexp, "--color-syntax-regexp"],
  ["escape", tags.escape, "--color-syntax-escape"],
  ["comment", tags.comment, "--color-syntax-comment"],
  ["docComment", tags.docComment, "--color-syntax-comment"],
  ["variableName", tags.variableName, "--color-syntax-variable"],
  ["local(variableName)", tags.local(tags.variableName), "--color-syntax-variable"],
  [
    "definition(variableName)",
    tags.definition(tags.variableName),
    "--color-syntax-variable-definition",
  ],
  ["function(variableName)", tags.function(tags.variableName), "--color-syntax-function"],
  [
    "function(definition(variableName))",
    tags.function(tags.definition(tags.variableName)),
    "--color-syntax-function",
  ],
  ["function(propertyName)", tags.function(tags.propertyName), "--color-syntax-method"],
  ["propertyName", tags.propertyName, "--color-syntax-property"],
  ["special(propertyName)", tags.special(tags.propertyName), "--color-syntax-property"],
  ["constant(variableName)", tags.constant(tags.variableName), "--color-syntax-property"],
  [
    "definition(propertyName)",
    tags.definition(tags.propertyName),
    "--color-syntax-property-definition",
  ],
  ["typeName", tags.typeName, "--color-syntax-type"],
  ["definition(typeName)", tags.definition(tags.typeName), "--color-syntax-type"],
  ["className", tags.className, "--color-syntax-type"],
  ["definition(className)", tags.definition(tags.className), "--color-syntax-type"],
  ["namespace", tags.namespace, "--color-syntax-type"],
  ["operator", tags.operator, "--color-syntax-operator"],
  ["arithmeticOperator", tags.arithmeticOperator, "--color-syntax-operator"],
  ["definitionOperator", tags.definitionOperator, "--color-syntax-operator"],
  ["derefOperator", tags.derefOperator, "--color-syntax-punctuation"],
  ["function(punctuation)", tags.function(tags.punctuation), "--color-syntax-arrow"],
  ["punctuation", tags.punctuation, "--color-syntax-punctuation"],
  ["separator", tags.separator, "--color-syntax-punctuation"],
  ["bracket", tags.bracket, "--color-syntax-punctuation"],
  ["paren", tags.paren, "--color-syntax-punctuation"],
  ["brace", tags.brace, "--color-syntax-punctuation"],
  ["squareBracket", tags.squareBracket, "--color-syntax-punctuation"],
  ["special(brace)", tags.special(tags.brace), "--color-syntax-interpolation"],
  ["meta", tags.meta, "--color-syntax-decorator"],
  ["annotation", tags.annotation, "--color-syntax-decorator"],
  ["processingInstruction", tags.processingInstruction, "--color-syntax-markup-mark"],
  ["tagName", tags.tagName, "--color-syntax-tag"],
  ["standard(tagName)", tags.standard(tags.tagName), "--color-syntax-tag"],
  ["angleBracket", tags.angleBracket, "--color-syntax-angle-bracket"],
  ["attributeName", tags.attributeName, "--color-syntax-attribute"],
  ["heading", tags.heading, "--color-syntax-heading"],
  ["heading1", tags.heading1, "--color-syntax-heading"],
  ["emphasis", tags.emphasis, "--color-syntax-emphasis"],
  ["strong", tags.strong, "--color-syntax-strong"],
  ["strikethrough", tags.strikethrough, "--color-syntax-strikethrough"],
  ["quote", tags.quote, "--color-syntax-quote"],
  ["contentSeparator", tags.contentSeparator, "--color-syntax-content-separator"],
  ["monospace", tags.monospace, "--color-syntax-monospace"],
  ["link", tags.link, "--color-syntax-link"],
  ["url", tags.url, "--color-syntax-url"],
  ["labelName", tags.labelName, null],
  ["content", tags.content, null],
  ["invalid", tags.invalid, null],
];

test("each tag gets its token in the minimap classes and in the text, the precedence cases included", () => {
  const expected = PROBED.map(([name, , colour]) => [name, colour]);

  expect(PROBED.map(([name, tag]) => [name, syntaxColourClasses.style([tag])])).toEqual(expected);
  expect(PROBED.map(([name, tag]) => [name, colourOfRule(tag)])).toEqual(expected);
});

test("a row carries only its own font styles, so a heading's bold survives an emphasis inside it", () => {
  const styled: readonly (readonly [Tag, string])[] = [
    [
      tags.heading,
      "color: var(--color-syntax-heading); font-weight: var(--syntax-heading-weight); font-style: var(--syntax-heading-style);",
    ],
    [
      tags.emphasis,
      "color: var(--color-syntax-emphasis); font-style: var(--syntax-emphasis-style);",
    ],
    [tags.strong, "color: var(--color-syntax-strong); font-weight: var(--syntax-strong-weight);"],
    [
      tags.strikethrough,
      "color: var(--color-syntax-strikethrough); text-decoration: var(--syntax-strikethrough-line);",
    ],
    [tags.quote, "color: var(--color-syntax-quote); font-style: var(--syntax-quote-style);"],
    [
      tags.contentSeparator,
      "color: var(--color-syntax-content-separator); font-weight: var(--syntax-content-separator-weight); font-style: var(--syntax-content-separator-style);",
    ],
    [tags.comment, "color: var(--color-syntax-comment); font-style: var(--syntax-comment-style);"],
    [
      tags.function(tags.variableName),
      "color: var(--color-syntax-function); font-style: var(--syntax-function-style);",
    ],
    [
      tags.link,
      "color: var(--color-syntax-link); text-decoration: var(--syntax-link-line); font-style: var(--syntax-link-style);",
    ],
    [
      tags.url,
      "color: var(--color-syntax-url); text-decoration: var(--syntax-url-line); font-style: var(--syntax-url-style);",
    ],
    [tags.keyword, "color: var(--color-syntax-keyword);"],
    [tags.function(tags.propertyName), "color: var(--color-syntax-method);"],
    [tags.monospace, "color: var(--color-syntax-monospace);"],
  ];

  expect(styled.map(([tag]) => ruleOf(tag))).toEqual(styled.map(([, rule]) => rule));
});

test("the table colours 39 distinct tokens and uses exactly the 14 style variables", () => {
  const used = new Set(
    [
      ...rules()
        .join("\n")
        .matchAll(/var\((--syntax-[\w-]+)\)/g),
    ].map(([, name]) => name),
  );

  expect(new Set(SYNTAX_COLOURS).size).toBe(SYNTAX_COLOURS.length);
  expect(SYNTAX_COLOURS).toHaveLength(39);
  expect(used).toEqual(
    new Set([
      "--syntax-comment-style",
      "--syntax-heading-weight",
      "--syntax-heading-style",
      "--syntax-emphasis-style",
      "--syntax-strong-weight",
      "--syntax-strikethrough-line",
      "--syntax-link-line",
      "--syntax-link-style",
      "--syntax-url-line",
      "--syntax-url-style",
      "--syntax-function-style",
      "--syntax-quote-style",
      "--syntax-content-separator-weight",
      "--syntax-content-separator-style",
    ]),
  );
});

test("parsed code: a declared function, a member access and a JSX tag take their own rows", async () => {
  const ts = await loaded(
    "a.tsx",
    'function declared(input: Shape) { return input.field; }\nconst made = <div title="t" />;\n',
  );
  const css = await loaded("a.css", ".box { width: 10px; }\n");
  const rust = await loaded("lib.rs", "fn f() -> char { 'q' }\n");

  expect(
    [
      "declared",
      "input:",
      "Shape",
      ".field",
      "field",
      "made",
      "div",
      "title",
      "return",
      "function",
    ].map((needle) => tokenAt(ts, needle)),
  ).toEqual([
    "--color-syntax-function",
    "--color-syntax-variable-definition",
    "--color-syntax-type",
    "--color-syntax-punctuation",
    "--color-syntax-property",
    "--color-syntax-variable-definition",
    "--color-syntax-tag",
    "--color-syntax-attribute",
    "--color-syntax-control-keyword",
    "--color-syntax-definition-keyword",
  ]);
  expect(tokenAt(css, "px")).toBe("--color-syntax-unit");
  expect(tokenAt(rust, "'q'")).toBe("--color-syntax-character");
});

function textColours(state: EditorState): (string | null)[] {
  const order = rules();
  const colours: (string | null)[] = Array.from({ length: state.doc.length }, () => null);
  highlightTree(syntaxTree(state), paletteHighlight, (from, to, classes) => {
    const matched = classes
      .split(" ")
      .map((name) => order.findIndex((line) => line.startsWith(`.${name} {`)))
      .filter((index) => index >= 0);
    const last = order[Math.max(...matched)] ?? "";
    colours.fill(COLOUR.exec(last)?.[1] ?? null, from, to);
  });
  return colours;
}

test("in nested Markdown the minimap's colour is the text's: the rule defined last wins", async () => {
  const state = await loaded(
    "a.md",
    [
      "# Title with [link](http://x.y) and `code` *em*",
      "> quote *em* **strong *both***",
      "",
      "---",
      "",
      "*[inner](u)* and [*outer*](u) <https://auto.link>",
      "",
    ].join("\n"),
  );
  const palette = ["--color-code", ...SYNTAX_COLOURS];
  const minimap = [...rowColours(state, 0, state.doc.length)].map((index) =>
    index === 0 ? null : (palette[index] ?? "missing"),
  );
  const text = textColours(state);

  expect(minimap).toEqual(text);
  expect(new Set(text)).toEqual(
    new Set([
      null,
      "--color-syntax-heading",
      "--color-syntax-markup-mark",
      "--color-syntax-link",
      "--color-syntax-url",
      "--color-syntax-monospace",
      "--color-syntax-emphasis",
      "--color-syntax-quote",
      "--color-syntax-strong",
      "--color-syntax-content-separator",
    ]),
  );
});

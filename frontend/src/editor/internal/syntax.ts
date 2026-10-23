import { HighlightStyle } from "@codemirror/language";
import { tagHighlighter, tags, type Highlighter, type Tag } from "@lezer/highlight";

const FONT_PROPERTY = {
  "--syntax-comment-style": "fontStyle",
  "--syntax-heading-weight": "fontWeight",
  "--syntax-heading-style": "fontStyle",
  "--syntax-emphasis-style": "fontStyle",
  "--syntax-strong-weight": "fontWeight",
  "--syntax-strikethrough-line": "textDecoration",
  "--syntax-link-line": "textDecoration",
  "--syntax-link-style": "fontStyle",
  "--syntax-url-line": "textDecoration",
  "--syntax-url-style": "fontStyle",
  "--syntax-function-style": "fontStyle",
  "--syntax-quote-style": "fontStyle",
  "--syntax-content-separator-weight": "fontWeight",
  "--syntax-content-separator-style": "fontStyle",
} as const satisfies Readonly<Record<string, "fontStyle" | "fontWeight" | "textDecoration">>;

type FontVariable = keyof typeof FONT_PROPERTY;

type SyntaxRow = {
  readonly colour: string;
  readonly tag: Tag | readonly Tag[];
  readonly fonts: readonly FontVariable[];
};

function row(
  colour: string,
  tag: Tag | readonly Tag[],
  fonts: readonly FontVariable[] = [],
): SyntaxRow {
  return { colour, tag, fonts };
}

// A span inside a Markdown container carries the container's class first (@lezer/highlight
// highlightTree, Mode.Inherit); CSS lets the later rule win, so containers come before what they hold.
const SYNTAX_ROWS: readonly SyntaxRow[] = [
  row("--color-syntax-quote", tags.quote, ["--syntax-quote-style"]),
  row("--color-syntax-heading", tags.heading, [
    "--syntax-heading-weight",
    "--syntax-heading-style",
  ]),
  row("--color-syntax-emphasis", tags.emphasis, ["--syntax-emphasis-style"]),
  row("--color-syntax-strong", tags.strong, ["--syntax-strong-weight"]),
  row("--color-syntax-strikethrough", tags.strikethrough, ["--syntax-strikethrough-line"]),
  row("--color-syntax-content-separator", tags.contentSeparator, [
    "--syntax-content-separator-weight",
    "--syntax-content-separator-style",
  ]),
  row("--color-syntax-keyword", [tags.keyword, tags.modifier, tags.operatorKeyword]),
  row("--color-syntax-control-keyword", [tags.controlKeyword, tags.moduleKeyword]),
  row("--color-syntax-definition-keyword", tags.definitionKeyword),
  row("--color-syntax-bool", tags.bool),
  row("--color-syntax-null", tags.null),
  row("--color-syntax-self", [tags.self, tags.atom]),
  row("--color-syntax-string", [tags.string, tags.special(tags.string), tags.attributeValue]),
  row("--color-syntax-character", tags.character),
  row("--color-syntax-number", tags.number),
  row("--color-syntax-unit", tags.unit),
  row("--color-syntax-colour-literal", tags.color),
  row("--color-syntax-regexp", tags.regexp),
  row("--color-syntax-escape", tags.escape),
  row("--color-syntax-comment", tags.comment, ["--syntax-comment-style"]),
  row("--color-syntax-variable", tags.variableName),
  row("--color-syntax-variable-definition", tags.definition(tags.variableName)),
  row(
    "--color-syntax-function",
    [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))],
    ["--syntax-function-style"],
  ),
  row("--color-syntax-method", tags.function(tags.propertyName)),
  row("--color-syntax-property", [
    tags.propertyName,
    tags.special(tags.propertyName),
    tags.constant(tags.variableName),
  ]),
  row("--color-syntax-property-definition", tags.definition(tags.propertyName)),
  row("--color-syntax-type", [
    tags.typeName,
    tags.definition(tags.typeName),
    tags.className,
    tags.definition(tags.className),
    tags.namespace,
  ]),
  row("--color-syntax-operator", tags.operator),
  row("--color-syntax-arrow", tags.function(tags.punctuation)),
  row("--color-syntax-punctuation", [
    tags.punctuation,
    tags.separator,
    tags.bracket,
    tags.paren,
    tags.brace,
    tags.squareBracket,
    tags.derefOperator,
  ]),
  row("--color-syntax-interpolation", tags.special(tags.brace)),
  row("--color-syntax-decorator", tags.meta),
  row("--color-syntax-markup-mark", tags.processingInstruction),
  row("--color-syntax-tag", [tags.tagName, tags.standard(tags.tagName)]),
  row("--color-syntax-angle-bracket", tags.angleBracket),
  row("--color-syntax-attribute", tags.attributeName),
  row("--color-syntax-monospace", tags.monospace),
  row("--color-syntax-link", tags.link, ["--syntax-link-line", "--syntax-link-style"]),
  row("--color-syntax-url", tags.url, ["--syntax-url-line", "--syntax-url-style"]),
];

export const SYNTAX_COLOURS: readonly string[] = SYNTAX_ROWS.map(({ colour }) => colour);

export const syntaxColourClasses: Highlighter = tagHighlighter(
  SYNTAX_ROWS.map(({ tag, colour }) => ({ tag, class: colour })),
);

export const paletteHighlight = HighlightStyle.define(
  SYNTAX_ROWS.map(({ tag, colour, fonts }) => ({
    tag,
    color: `var(${colour})`,
    ...Object.fromEntries(fonts.map((font) => [FONT_PROPERTY[font], `var(${font})`])),
  })),
);

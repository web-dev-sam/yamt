import type {
  Description,
  DescriptionBlock,
  DescriptionCell,
  DescriptionInline,
  DescriptionItem,
  DescriptionRow,
} from "../../ipc";
import { languageNamed } from "./language";
import {
  FENCE,
  fencedLines,
  indentOf,
  isBlank,
  LINE_BREAK,
  parseBlocks,
  RULE,
  type Block,
  type CodeBlock,
} from "./markdownBlocks";
import { parseInline } from "./markdownInline";
import type { Align, Table } from "./markdownTable";
import { MAX_NESTING, type Inline } from "./markdownTree";

/** Fenced-block languages GitLab draws instead of showing code (docs.gitlab.com: Diagrams and flowcharts, Math,
 *  GeoJSON, STL, suggestions); each goes to GitLab even if yamt colours it. */
export const GITLAB_DRAWN_LANGUAGES = [
  "mermaid",
  "plantuml",
  "math",
  "suggestion",
  "geojson",
  "topojson",
  "stl",
  "kroki",
  "actdiag",
  "blockdiag",
  "bpmn",
  "bytefield",
  "c4plantuml",
  "d2",
  "dbml",
  "ditaa",
  "dot",
  "erd",
  "excalidraw",
  "graphviz",
  "nomnoml",
  "nwdiag",
  "packetdiag",
  "pikchr",
  "rackdiag",
  "seqdiag",
  "structurizr",
  "svgbob",
  "symbolator",
  "tikz",
  "umlet",
  "vega",
  "vegalite",
  "wavedrom",
  "wireviz",
] as const;

const NESTING_LIMIT = MAX_NESTING - 1;
const INDENTED_CODE_COLUMNS = 4;
const OUTSIDE_CODE = ["\\", "[", "<", "{", "$"] as const;
const NUL = "\0";
const ENCODING_LINE = "coding:";
const TEXT_TRIGGERS: Readonly<Record<string, RegExp>> = {
  reference: /[#!%@][\p{L}\p{N}_"]/u,
  entity: /&[\p{L}\p{N}_#]/u,
  label: /~/,
  emojiCode: /:[A-Za-z0-9_+-]+:/,
  pictograph: /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{20E3}]/u,
  scheme: /[A-Za-z][A-Za-z0-9+.-]*:\/\//,
  www: /www\./i,
  mailOrChat: /mailto:|xmpp:/i,
  commit: /(?<![\p{L}\p{N}_])[0-9A-Fa-f]{7,40}(?![\p{L}\p{N}_])/u,
  gitlabIssue: /GL-\d/,
  iteration: /iteration:/,
  projectPath: /[\p{L}\p{N}_.-]\/[\p{L}\p{N}_.-]+>/u,
};
const LINE_TRIGGERS: Readonly<Record<string, RegExp>> = {
  parenItem: /^\s*\d{1,9}\)(\s|$)/,
  plusItem: /^\s*\+(\s|$)/,
  longQuote: /^ {0,3}>>>/,
  descriptionList: /^\s*:\s/,
  tab: /\t/,
  otherWhiteSpace: /[^\S \t\r\n]/,
  quickAction: /^\/[A-Za-z]/,
  emptyItem: /^\s*([-*]|\d{1,9}\.)\s*$/,
};
const CONTAINER_PREFIX = /^ {0,3}(?:> ?|(?:[-*+]|\d{1,9}[.)])(?: |$))|^ +/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const FRONT_MATTER_OPENER = /^(---|\+\+\+|;;;)[ \t]*\S*[ \t]*$/;
const DASH_ITEM = /^\s*-\s/;
const STAR_ITEM = /^\s*\*\s/;
const WHITE_SPACE = /\s/;
const LANGUAGE_WORD = /^[a-z0-9_+-]+$/;
const CELL_ALIGN: Readonly<Record<Align, DescriptionCell["align"]>> = {
  none: "start",
  left: "start",
  center: "center",
  right: "end",
};

function allOrNull<T, U>(items: readonly T[], convert: (item: T) => U | null): U[] | null {
  const converted: U[] = [];
  for (const item of items) {
    const one = convert(item);
    if (one === null) {
      return null;
    }
    converted.push(one);
  }
  return converted;
}

function countOf(text: string, char: string): number {
  return text.split(char).length - 1;
}

function containerLayers(line: string): string[] {
  const layers = [line];
  let inner = line;
  while (layers.length <= MAX_NESTING && !RULE.test(inner)) {
    const prefix = CONTAINER_PREFIX.exec(inner)?.[0];
    if (prefix === undefined) {
      break;
    }
    inner = inner.slice(prefix.length);
    layers.push(inner);
  }
  return layers;
}

function lineGoesToGitLab(lines: readonly string[], at: number): boolean {
  const afterBlank = isBlank(lines[at - 1] ?? "");
  return containerLayers(lines[at] ?? "").some((layer, depth) => {
    const [, , , fenceInfo = ""] = FENCE.exec(layer) ?? [];
    return (
      (!afterBlank && SETEXT_UNDERLINE.test(layer)) ||
      ((afterBlank || depth > 0) && indentOf(layer) >= INDENTED_CODE_COLUMNS) ||
      WHITE_SPACE.test(fenceInfo.trim()) ||
      Object.values(LINE_TRIGGERS).some((trigger) => trigger.test(layer))
    );
  });
}

function frontMatterOpens(lines: readonly string[]): boolean {
  const afterEncoding = (lines[0] ?? "").includes(ENCODING_LINE) ? lines.slice(1) : lines;
  return FRONT_MATTER_OPENER.test(afterEncoding.find((line) => !isBlank(line)) ?? "");
}

function linesGoToGitLab(text: string): boolean {
  const lines = text.split(LINE_BREAK);
  const fenced = fencedLines(text);
  const outside = lines.flatMap((line, at) => (fenced.has(at) ? [] : containerLayers(line)));
  const dashItems = outside.some((layer) => DASH_ITEM.test(layer));
  const starItems = outside.some((layer) => STAR_ITEM.test(layer));
  return (
    text.includes(NUL) ||
    frontMatterOpens(lines) ||
    (dashItems && starItems) ||
    lines.some((_, at) => !fenced.has(at) && lineGoesToGitLab(lines, at))
  );
}

function codeText(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => {
      if (inline.kind === "code") {
        return inline.text;
      }
      return "children" in inline ? codeText(inline.children) : "";
    })
    .join("");
}

function describedInline(parsed: Inline, depth: number): DescriptionInline | null {
  switch (parsed.kind) {
    case "text":
      return Object.values(TEXT_TRIGGERS).some((trigger) => trigger.test(parsed.text))
        ? null
        : parsed;
    case "code":
      return parsed;
    case "break":
      return { kind: "lineBreak" };
    case "emphasis":
    case "strong":
    case "strike": {
      const inlines = describedInlines(parsed.children, depth + 1);
      return inlines === null ? null : { kind: parsed.kind, inlines };
    }
    case "link":
      return null;
  }
}

function describedInlines(parsed: readonly Inline[], depth: number): DescriptionInline[] | null {
  return depth >= NESTING_LIMIT
    ? null
    : allOrNull(parsed, (inline) => describedInline(inline, depth));
}

function describedSource(source: string): DescriptionInline[] | null {
  const parsed = parseInline(source, "commonMark");
  const code = codeText(parsed);
  const outsideCode = OUTSIDE_CODE.some((char) => countOf(source, char) > countOf(code, char));
  return outsideCode ? null : describedInlines(parsed, 0);
}

function codeGoesToGitLab({ info, code }: CodeBlock): boolean {
  const lines = code.split("\n");
  const blankEdge = isBlank(lines[0] ?? "") || isBlank(lines.at(-1) ?? "");
  const shownAsWritten =
    LANGUAGE_WORD.test(info) &&
    languageNamed(info) !== null &&
    !GITLAB_DRAWN_LANGUAGES.some((drawn) => drawn === info);
  return blankEdge || (info !== "" && !shownAsWritten);
}

function describedTable({ align, header, rows }: Table): DescriptionBlock | null {
  function describedRow(cells: readonly string[], isHeader: boolean): DescriptionRow | null {
    const described = allOrNull([...cells.entries()], ([column, cell]): DescriptionCell | null => {
      const inlines = describedSource(cell);
      const cellAlign = CELL_ALIGN[align[column] ?? "none"];
      return inlines === null ? null : { header: isHeader, align: cellAlign, inlines };
    });
    return described === null ? null : { cells: described };
  }
  const head = describedRow(header, true);
  const body = allOrNull(rows, (row) => describedRow(row, false));
  return head === null || body === null ? null : { kind: "table", head: [head], body };
}

function describedList(
  parsed: Extract<Block, { kind: "list" }>,
  depth: number,
): DescriptionBlock | null {
  const items = allOrNull(parsed.items, (item): DescriptionItem | null => {
    const blocks = describedBlocks(item.blocks, depth + 1);
    return blocks === null ? null : { task: "none", blocks };
  });
  if (items === null) {
    return null;
  }
  const { numbering } = parsed;
  return numbering.kind === "bullet"
    ? { kind: "list", numbering: { kind: "bullets" }, items }
    : { kind: "list", numbering: { kind: "numbers", start: numbering.start }, items };
}

function describedBlock(parsed: Block, depth: number): DescriptionBlock | null {
  switch (parsed.kind) {
    case "paragraph": {
      const inlines = describedSource(parsed.text);
      return inlines === null ? null : { kind: "paragraph", inlines };
    }
    case "heading": {
      const inlines = describedSource(parsed.text);
      return inlines === null ? null : { kind: "heading", level: parsed.tag, inlines };
    }
    case "code":
      return codeGoesToGitLab(parsed)
        ? null
        : { kind: "code", language: parsed.info === "" ? null : parsed.info, text: parsed.code };
    case "list":
      return describedList(parsed, depth);
    case "quote": {
      const blocks = describedBlocks(parsed.blocks, depth + 1);
      return blocks === null ? null : { kind: "quote", blocks };
    }
    case "table":
      return describedTable(parsed);
    case "rule":
      return parsed;
  }
}

function describedBlocks(parsed: readonly Block[], depth: number): DescriptionBlock[] | null {
  return depth >= NESTING_LIMIT ? null : allOrNull(parsed, (block) => describedBlock(block, depth));
}

/** `text` as yamt's Markdown subset draws it, in the blocks GitLab's preview reduces to, when that is exactly what
 *  GitLab's preview shows (plan §2 row 186); null when anything in it may render otherwise on GitLab — then GitLab
 *  must. The one owner of that decision (design §1.2). Never called with a blank text (the caller words it). */
export function localPreview(text: string): Description | null {
  if (linesGoToGitLab(text)) {
    return null;
  }
  const blocks = describedBlocks(
    parseBlocks(text).map(({ block }) => block),
    0,
  );
  return blocks === null ? null : { blocks };
}

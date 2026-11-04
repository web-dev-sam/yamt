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
  type Block,
  type CodeBlock,
} from "./markdownBlocks";
import { parseInline } from "./markdownInline";
import type { Table } from "./markdownTable";
import type { Inline } from "./markdownTree";

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

const NESTING_LIMIT = 15;
const INDENTED_CODE_COLUMNS = 4;
const OUTSIDE_CODE = ["\\", "[", "<", "{", "$"] as const;
const TEXT_TRIGGERS: readonly RegExp[] = [
  /[#!%@][\p{L}\p{N}_"]/u,
  /&[\p{L}\p{N}_#]/u,
  /~/,
  /:[A-Za-z0-9_+-]+:/,
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{20E3}]/u,
  /[A-Za-z][A-Za-z0-9+.-]*:\/\//,
  /www\./i,
  /mailto:|xmpp:/i,
  /(?<![\p{L}\p{N}_])[0-9A-Fa-f]{7,40}(?![\p{L}\p{N}_])/u,
];
const LINE_TRIGGERS: readonly RegExp[] = [
  /^\s*\d{1,9}\)(\s|$)/,
  /^\s*\+(\s|$)/,
  /^ {0,3}>>>/,
  /^\s*:\s/,
  /[\t\0]/,
  /^\/[A-Za-z]/,
  /^\s*([-*]|\d{1,9}\.)\s*$/,
];
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const FRONT_MATTER = /^(---|\+\+\+|;;;)\s*$/;
const DASH_ITEM = /^\s*-\s/;
const STAR_ITEM = /^\s*\*\s/;
const WHITE_SPACE = /\s/;
const LANGUAGE_WORD = /^[a-z0-9_+-]+$/;

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

function lineGoesToGitLab(lines: readonly string[], at: number): boolean {
  const line = lines[at] ?? "";
  const afterBlank = isBlank(lines[at - 1] ?? "");
  const [, , , fenceInfo = ""] = FENCE.exec(line) ?? [];
  return (
    (!afterBlank && SETEXT_UNDERLINE.test(line)) ||
    (afterBlank && indentOf(line) >= INDENTED_CODE_COLUMNS) ||
    WHITE_SPACE.test(fenceInfo.trim()) ||
    LINE_TRIGGERS.some((trigger) => trigger.test(line))
  );
}

function linesGoToGitLab(text: string): boolean {
  const lines = text.split(LINE_BREAK);
  const fenced = fencedLines(text);
  const outside = lines.filter((_, at) => !fenced.has(at));
  const dashItems = outside.some((line) => DASH_ITEM.test(line));
  const starItems = outside.some((line) => STAR_ITEM.test(line));
  return (
    FRONT_MATTER.test(lines[0] ?? "") ||
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

function inlineOf(parsed: Inline, depth: number): DescriptionInline | null {
  switch (parsed.kind) {
    case "text":
      return TEXT_TRIGGERS.some((trigger) => trigger.test(parsed.text)) ? null : parsed;
    case "code":
      return parsed;
    case "break":
      return { kind: "lineBreak" };
    case "emphasis":
    case "strong":
    case "strike": {
      const inlines = inlinesOf(parsed.children, depth + 1);
      return inlines === null ? null : { kind: parsed.kind, inlines };
    }
    case "link":
      return null;
  }
}

function inlinesOf(parsed: readonly Inline[], depth: number): DescriptionInline[] | null {
  return depth >= NESTING_LIMIT ? null : allOrNull(parsed, (inline) => inlineOf(inline, depth));
}

function sourceInlines(source: string): DescriptionInline[] | null {
  const parsed = parseInline(source, "commonMark");
  const code = codeText(parsed);
  const outsideCode = OUTSIDE_CODE.some((char) => countOf(source, char) > countOf(code, char));
  return outsideCode ? null : inlinesOf(parsed, 0);
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

function rowOf(cells: readonly string[], header: boolean): DescriptionRow | null {
  const described = allOrNull(cells, (cell): DescriptionCell | null => {
    const inlines = sourceInlines(cell);
    return inlines === null ? null : { header, align: "start", inlines };
  });
  return described === null ? null : { cells: described };
}

function tableOf(parsed: Table): DescriptionBlock | null {
  const head = rowOf(parsed.header, true);
  const body = allOrNull(parsed.rows, (row) => rowOf(row, false));
  return head === null || body === null ? null : { kind: "table", head: [head], body };
}

function listOf(parsed: Extract<Block, { kind: "list" }>, depth: number): DescriptionBlock | null {
  const items = allOrNull(parsed.items, (item): DescriptionItem | null => {
    const blocks = blocksOf(item.blocks, depth + 1);
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

function blockOf(parsed: Block, depth: number): DescriptionBlock | null {
  switch (parsed.kind) {
    case "paragraph": {
      const inlines = sourceInlines(parsed.text);
      return inlines === null ? null : { kind: "paragraph", inlines };
    }
    case "heading": {
      const inlines = sourceInlines(parsed.text);
      return inlines === null ? null : { kind: "heading", level: parsed.tag, inlines };
    }
    case "code":
      return codeGoesToGitLab(parsed)
        ? null
        : { kind: "code", language: parsed.info === "" ? null : parsed.info, text: parsed.code };
    case "list":
      return listOf(parsed, depth);
    case "quote": {
      const blocks = blocksOf(parsed.blocks, depth + 1);
      return blocks === null ? null : { kind: "quote", blocks };
    }
    case "table":
      return tableOf(parsed);
    case "rule":
      return parsed;
  }
}

function blocksOf(parsed: readonly Block[], depth: number): DescriptionBlock[] | null {
  return depth >= NESTING_LIMIT ? null : allOrNull(parsed, (block) => blockOf(block, depth));
}

/** `text` as yamt's Markdown subset draws it, in the blocks GitLab's preview reduces to, when that is exactly what
 *  GitLab's preview shows (plan §2 row 186); null when anything in it may render otherwise on GitLab — then GitLab
 *  must. The one owner of that decision (design §1.2). Never called with a blank text (the caller words it). */
export function localPreview(text: string): Description | null {
  if (linesGoToGitLab(text)) {
    return null;
  }
  const blocks = blocksOf(
    parseBlocks(text).map(({ block }) => block),
    0,
  );
  return blocks === null ? null : { blocks };
}

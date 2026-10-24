type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type Align = "none" | "left" | "center" | "right";

export type Numbering =
  | { readonly kind: "bullet" }
  | { readonly kind: "ordered"; readonly start: number };

export type ListItem = { readonly blocks: readonly Block[] };

export type Block =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "heading"; readonly tag: HeadingTag; readonly text: string }
  | { readonly kind: "code"; readonly info: string; readonly code: string }
  | { readonly kind: "list"; readonly numbering: Numbering; readonly items: readonly ListItem[] }
  | { readonly kind: "quote"; readonly blocks: readonly Block[] }
  | {
      readonly kind: "table";
      readonly align: readonly Align[];
      readonly header: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | { readonly kind: "rule" };

export type SourcedBlock = { readonly source: string; readonly block: Block };

type Parsed = { readonly block: Block; readonly end: number };

type ItemStart = { readonly numbering: Numbering; readonly column: number; readonly first: string };

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const satisfies readonly HeadingTag[];
const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const HEADING_CLOSE = /(?:^|[ \t]+)#+$/;
const RULE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const ITEM = /^( {0,3})([-*]|\d{1,9}\.)(?:( +)(.*))?$/;
const DELIMITER_CELL = /^:?-+:?$/;
const ALIGN: Readonly<Record<string, Align>> = { "::": "center", ":-": "left", "-:": "right" };
const LEADING_PIPE = /^\|/;
const TRAILING_PIPE = /(?<!\\)\|$/;
const CELL_PIPE = /(?<!\\)\|/;
const WHITESPACE = /^[ \t]$/;
const LINE_BREAK = /\r\n|\n|\r/;
const TAB_STOP = 4;
const MAX_ITEM_GAP = 4;
const TABLE_HEAD_LINES = 2;

function lineAt(lines: readonly string[], at: number): string {
  return lines[at] ?? "";
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

function indentOf(line: string): number {
  let width = 0;
  for (const char of line) {
    if (char === " ") {
      width += 1;
    } else if (char === "\t") {
      width += TAB_STOP - (width % TAB_STOP);
    } else {
      break;
    }
  }
  return width;
}

function stripColumns(line: string, columns: number): string {
  let at = 0;
  while (WHITESPACE.test(line.charAt(at)) && indentOf(line.slice(0, at + 1)) <= columns) {
    at += 1;
  }
  return line.slice(at);
}

function closesFence(line: string, marks: string): boolean {
  const close = CLOSING_FENCE.exec(line)?.[1];
  return close !== undefined && close[0] === marks[0] && close.length >= marks.length;
}

function fence(lines: readonly string[], at: number): Parsed | null {
  const open = FENCE.exec(lineAt(lines, at));
  const [, indent = "", marks = "", rest = ""] = open ?? [];
  if (open === null || (marks.startsWith("`") && rest.includes("`"))) {
    return null;
  }
  const info = rest.trim().split(/\s+/)[0] ?? "";
  const code: string[] = [];
  for (let end = at + 1; end < lines.length; end += 1) {
    const line = lineAt(lines, end);
    if (closesFence(line, marks)) {
      return { block: { kind: "code", info, code: code.join("\n") }, end: end + 1 };
    }
    code.push(stripColumns(line, indent.length));
  }
  return { block: { kind: "code", info, code: code.join("\n") }, end: lines.length };
}

function heading(lines: readonly string[], at: number): Parsed | null {
  const [, marks = "", content = ""] = HEADING.exec(lineAt(lines, at)) ?? [];
  const tag = HEADING_TAGS[marks.length - 1];
  if (tag === undefined) {
    return null;
  }
  return { block: { kind: "heading", tag, text: content.replace(HEADING_CLOSE, "") }, end: at + 1 };
}

function rule(lines: readonly string[], at: number): Parsed | null {
  return RULE.test(lineAt(lines, at)) ? { block: { kind: "rule" }, end: at + 1 } : null;
}

function cells(line: string): string[] {
  const inner = line.trim().replace(LEADING_PIPE, "").replace(TRAILING_PIPE, "");
  return inner.split(CELL_PIPE).map((cell) => cell.trim());
}

function delimiterRow(line: string, columns: number): Align[] | null {
  const row = cells(line);
  if (
    !line.includes("|") ||
    row.length !== columns ||
    !row.every((cell) => DELIMITER_CELL.test(cell))
  ) {
    return null;
  }
  return row.map((cell) => ALIGN[`${cell.at(0)}${cell.at(-1)}`] ?? "none");
}

function startsTable(lines: readonly string[], at: number): boolean {
  const header = lineAt(lines, at);
  const next = lineAt(lines, at + 1);
  return header.includes("|") && delimiterRow(next, cells(header).length) !== null;
}

function table(lines: readonly string[], at: number): Parsed | null {
  if (!startsTable(lines, at)) {
    return null;
  }
  const header = cells(lineAt(lines, at));
  const align = delimiterRow(lineAt(lines, at + 1), header.length) ?? [];
  const rows: string[][] = [];
  let end = at + TABLE_HEAD_LINES;
  while (end < lines.length && lineAt(lines, end).includes("|")) {
    const row = cells(lineAt(lines, end));
    rows.push(header.map((_, column) => row[column] ?? ""));
    end += 1;
  }
  return { block: { kind: "table", align, header, rows }, end };
}

function itemStart(line: string): ItemStart | null {
  const match = ITEM.exec(line);
  if (match === null) {
    return null;
  }
  const [, indent = "", marker = "", gap = "", first = ""] = match;
  const width = gap.length === 0 || gap.length > MAX_ITEM_GAP ? 1 : gap.length;
  const extra = gap.length > MAX_ITEM_GAP ? gap.slice(1) : "";
  const numbering: Numbering = marker.endsWith(".")
    ? { kind: "ordered", start: Number.parseInt(marker, 10) }
    : { kind: "bullet" };
  return { numbering, column: indent.length + marker.length + width, first: extra + first };
}

function interrupts(lines: readonly string[], at: number): boolean {
  const line = lineAt(lines, at);
  const item = itemStart(line);
  const listStarts =
    item !== null &&
    item.first.trim() !== "" &&
    (item.numbering.kind === "bullet" || item.numbering.start === 1);
  return (
    listStarts ||
    QUOTE.test(line) ||
    [fence, heading, rule].some((starts) => starts(lines, at) !== null) ||
    startsTable(lines, at)
  );
}

function quote(lines: readonly string[], at: number): Parsed | null {
  const inner: string[] = [];
  let end = at;
  while (end < lines.length) {
    const line = lineAt(lines, end);
    const quoted = QUOTE.exec(line)?.[1];
    const lazy = end > at && !isBlank(line) && !isBlank(inner.at(-1) ?? "");
    if (quoted !== undefined) {
      inner.push(quoted);
    } else if (lazy && !interrupts(lines, end)) {
      inner.push(line);
    } else {
      break;
    }
    end += 1;
  }
  return end === at ? null : { block: { kind: "quote", blocks: blocksOf(inner) }, end };
}

function itemEnd(
  lines: readonly string[],
  at: number,
  start: ItemStart,
  content: string[],
): number {
  let end = at + 1;
  let blanks = 0;
  for (let next = at + 1; next < lines.length; next += 1) {
    const line = lineAt(lines, next);
    if (isBlank(line)) {
      blanks += 1;
    } else if (indentOf(line) >= start.column) {
      content.push(...Array.from({ length: blanks }, () => ""), stripColumns(line, start.column));
      blanks = 0;
      end = next + 1;
    } else if (blanks === 0 && itemStart(line) === null && !interrupts(lines, next)) {
      content.push(line.trimStart());
      end = next + 1;
    } else {
      break;
    }
  }
  return end;
}

function list(lines: readonly string[], at: number): Parsed | null {
  const first = itemStart(lineAt(lines, at));
  if (first === null) {
    return null;
  }
  const items: ListItem[] = [];
  let start = first;
  let end = at;
  for (;;) {
    const content = [start.first];
    end = itemEnd(lines, end, start, content);
    items.push({ blocks: blocksOf(content) });
    let next = end;
    while (next < lines.length && isBlank(lineAt(lines, next))) {
      next += 1;
    }
    const following = next < lines.length ? itemStart(lineAt(lines, next)) : null;
    if (following === null || following.numbering.kind !== first.numbering.kind) {
      return { block: { kind: "list", numbering: first.numbering, items }, end };
    }
    start = following;
    end = next;
  }
}

function paragraph(lines: readonly string[], at: number): Parsed {
  const text: string[] = [lineAt(lines, at).trimStart()];
  let end = at + 1;
  while (end < lines.length && !isBlank(lineAt(lines, end)) && !interrupts(lines, end)) {
    text.push(lineAt(lines, end).trimStart());
    end += 1;
  }
  return { block: { kind: "paragraph", text: text.join("\n") }, end };
}

function parsedAt(lines: readonly string[], at: number): Parsed {
  const starters = [fence, heading, rule, quote, list, table];
  for (const starts of starters) {
    const parsed = starts(lines, at);
    if (parsed !== null) {
      return parsed;
    }
  }
  return paragraph(lines, at);
}

function sourced(lines: readonly string[]): SourcedBlock[] {
  const blocks: SourcedBlock[] = [];
  let at = 0;
  while (at < lines.length) {
    if (isBlank(lineAt(lines, at))) {
      at += 1;
      continue;
    }
    const { block, end } = parsedAt(lines, at);
    blocks.push({ source: lines.slice(at, end).join("\n"), block });
    at = end;
  }
  return blocks;
}

function blocksOf(lines: readonly string[]): Block[] {
  return sourced(lines).map(({ block }) => block);
}

export function parseBlocks(text: string): SourcedBlock[] {
  return sourced(text.split(LINE_BREAK));
}

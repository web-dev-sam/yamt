import type { AnsiColour } from "./ansiColours";
import { PLAIN_PEN, penAfter, type Pen } from "./sgr";

export type LogStyle = Omit<Pen, "foreground"> & {
  readonly foreground: AnsiColour | null; // null: the box's own text colour
};
export type LogRun = { readonly text: string; readonly style: LogStyle }; // text never ""
export type LogLine = { readonly runs: readonly LogRun[] }; // at least one run
export type JobLogView = {
  readonly lines: readonly LogLine[];
  /** Every line's runs' texts joined, the lines joined by "\n": what the search runs over (rule 8: what is shown). */
  readonly text: string;
};
export type LogHit = { readonly line: number; readonly from: number; readonly to: number }; // UTF-16, from < to
export type RunPoint = { readonly run: number; readonly offset: number };
export type HitPlace = { readonly line: number; readonly start: RunPoint; readonly end: RunPoint };

type Token =
  | { readonly kind: "section"; readonly end: number }
  | { readonly kind: "sgr"; readonly parameters: string; readonly end: number }
  | { readonly kind: "clear"; readonly end: number }
  | { readonly kind: "dropped"; readonly end: number };

type Scan = {
  pen: Pen;
  style: LogStyle;
  runs: LogRun[];
  readonly lines: LogLine[];
};

const TIMESTAMP = /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d{6}Z [0-9a-f]{2}[EO][+ ]/;
const TIMESTAMP_LENGTH = 32;
const SECTION = /^section_(?:start|end):\d+:[A-Za-z0-9_.-]+(?:\[\w+=\w+(?:, ?\w+=\w+)*\])?/;
const SECTION_END = "\r\x1b[0K";
const CONTROL_OR_SECTION = /[^\t -~\u0080-\uFFFF]|section_/;
const ESCAPE = "\x1b";

function continues(line: string | undefined): boolean {
  return line !== undefined && TIMESTAMP.test(line) && line.charAt(TIMESTAMP_LENGTH - 1) === "+";
}

function withoutBreakReturns(line: string): string {
  let end = line.length;
  while (line.charAt(end - 1) === "\r") {
    end -= 1;
  }
  return line.slice(0, end);
}

function logicalLines(raw: string): readonly string[] {
  const physical = raw.split("\n");
  const timestamped = TIMESTAMP.test(physical[0] ?? "");
  const lines: string[] = [];
  let joined = "";
  for (const [at, line] of physical.entries()) {
    joined += timestamped && TIMESTAMP.test(line) ? line.slice(TIMESTAMP_LENGTH) : line;
    const next = physical[at + 1];
    if (next === undefined) {
      lines.push(joined);
    } else if (!(timestamped && continues(next))) {
      lines.push(withoutBreakReturns(joined));
      joined = "";
    }
  }
  return lines;
}

function escapeAt(line: string, at: number): Token {
  const introducerAt = at + 1;
  const introducer = line.charAt(introducerAt);
  if (introducer < "@" || introducer > "_") {
    return { kind: "dropped", end: introducerAt };
  }
  for (let end = introducerAt + 1; end < line.length; end += 1) {
    const final = line.charAt(end);
    if (final >= "@" && final <= "~") {
      return introducer === "[" && final === "m"
        ? { kind: "sgr", parameters: line.slice(introducerAt + 1, end), end: end + 1 }
        : { kind: "dropped", end: end + 1 };
    }
  }
  return { kind: "dropped", end: line.length };
}

function sectionAt(line: string, at: number): Token | null {
  const marker = SECTION.exec(line.slice(at));
  if (marker === null) {
    return null;
  }
  const end = at + marker[0].length;
  return line.startsWith(SECTION_END, end)
    ? { kind: "section", end: end + SECTION_END.length }
    : null;
}

function tokenAt(line: string, at: number): Token | null {
  switch (line.charAt(at)) {
    case ESCAPE:
      return escapeAt(line, at);
    case "\r":
      return { kind: "clear", end: at + 1 };
    case "s":
      return sectionAt(line, at);
    default:
      return { kind: "dropped", end: at + 1 };
  }
}

function nextSpecial(line: string, from: number): number {
  const found = line.slice(from).search(CONTROL_OR_SECTION);
  return found === -1 ? line.length : from + found;
}

function shownStyle({ foreground, ...attributes }: Pen): LogStyle {
  const shown = attributes.bold ? foreground?.whenBold : foreground?.colour;
  return { ...attributes, foreground: shown ?? null };
}

function sameStyle(left: LogStyle, right: LogStyle): boolean {
  return Object.entries(left).every(([field, value]) => Reflect.get(right, field) === value);
}

function addText(scan: Scan, text: string): void {
  if (text === "") {
    return;
  }
  const last = scan.runs.at(-1);
  if (last !== undefined && sameStyle(last.style, scan.style)) {
    scan.runs[scan.runs.length - 1] = { text: last.text + text, style: last.style };
  } else {
    scan.runs.push({ text, style: scan.style });
  }
}

function endLine(scan: Scan): void {
  if (scan.runs.length > 0) {
    scan.lines.push({ runs: scan.runs });
    scan.runs = [];
  }
}

function applied(scan: Scan, token: Token): void {
  switch (token.kind) {
    case "section":
      endLine(scan);
      return;
    case "sgr":
      scan.pen = penAfter(scan.pen, token.parameters);
      scan.style = shownStyle(scan.pen);
      return;
    case "clear":
      scan.runs = [];
      return;
    case "dropped":
      return;
  }
}

function scanLine(scan: Scan, line: string): void {
  let textFrom = 0;
  let at = nextSpecial(line, 0);
  while (at < line.length) {
    const token = tokenAt(line, at);
    if (token === null) {
      at = nextSpecial(line, at + 1);
    } else {
      addText(scan, line.slice(textFrom, at));
      applied(scan, token);
      textFrom = token.end;
      at = nextSpecial(line, textFrom);
    }
  }
  addText(scan, line.slice(textFrom));
  endLine(scan);
}

function lineText(line: LogLine): string {
  return line.runs.map((run) => run.text).join("");
}

/** The log as GitLab's job page shows it (the rules and their sources: `mergeRequests/AGENTS.md`). Total: any string
 *  gives a view, "" none of its lines. */
export function jobLogView(raw: string): JobLogView {
  const scan: Scan = { pen: PLAIN_PEN, style: shownStyle(PLAIN_PEN), runs: [], lines: [] };
  for (const line of logicalLines(raw)) {
    scanLine(scan, line);
  }
  return { lines: scan.lines, text: scan.lines.map(lineText).join("\n") };
}

function pointAt(runs: readonly LogRun[], column: number, edge: "start" | "end"): RunPoint | null {
  let runStart = 0;
  for (const [run, { text }] of runs.entries()) {
    const runEnd = runStart + text.length;
    if (edge === "start" ? column < runEnd : column <= runEnd) {
      return { run, offset: column - runStart };
    }
    runStart = runEnd;
  }
  return null;
}

/** Where each hit of `view.text` starts and ends among its line's runs, in order. A `from` at a run's end starts in
 *  the next run (offset 0); a `to` at a run's end ends in that run (offset = its length); a hit outside the view is
 *  left out. */
export function hitPlaces(view: JobLogView, hits: readonly LogHit[]): readonly HitPlace[] {
  const places: HitPlace[] = [];
  for (const { line, from, to } of hits) {
    const runs = view.lines[line]?.runs ?? [];
    const start = from < 0 ? null : pointAt(runs, from, "start");
    const end = pointAt(runs, to, "end");
    if (start !== null && end !== null) {
      places.push({ line, start, end });
    }
  }
  return places;
}

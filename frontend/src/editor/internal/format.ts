import { indentUnit } from "@codemirror/language";
import {
  Text,
  type ChangeSpec,
  type EditorState,
  type Line,
  type StateField,
  type TransactionSpec,
} from "@codemirror/state";

import type { FormatRefusal, FormattingOptions, OpenDocument } from "../../lsp";
import type { ChunkSpan } from "./chunkField";
import { lineDiff, type LineEdit } from "./lineDiff";
import { paneText } from "./pane";
import { isResolved } from "./status";

export type FormatOutcome =
  | { readonly kind: "formatted" | "unchanged" | "changedMeanwhile"; readonly server: string }
  | FormatRefusal;

export type ResultPane = {
  readonly state: EditorState;
  dispatch(spec: TransactionSpec): void;
};

type LeftAlone = { readonly first: number; readonly last: number };

export function formattingOptions(state: EditorState): FormattingOptions {
  const unit = state.facet(indentUnit);
  return unit.startsWith("\t")
    ? { tabSize: state.tabSize, insertSpaces: false }
    : { tabSize: unit.length, insertSpaces: true };
}

function lineReplace(line: Line, next: string): ChangeSpec[] {
  const old = line.text;
  const shorter = Math.min(old.length, next.length);
  let start = 0;
  while (start < shorter && old[start] === next[start]) {
    start += 1;
  }
  let end = 0;
  while (end < shorter - start && old.at(-1 - end) === next.at(-1 - end)) {
    end += 1;
  }
  if (start === old.length && start === next.length) {
    return [];
  }
  return [
    { from: line.from + start, to: line.to - end, insert: next.slice(start, next.length - end) },
  ];
}

function extraLines(doc: Text, { from, to, lines }: LineEdit, afterPair: boolean): ChangeSpec {
  if (lines.length > 0) {
    return afterPair || from === doc.lines
      ? { from: doc.line(from).to, insert: Text.of(["", ...lines]) }
      : { from: doc.line(from + 1).from, insert: Text.of([...lines, ""]) };
  }
  if (to < doc.lines) {
    return { from: doc.line(from + 1).from, to: doc.line(to + 1).from };
  }
  return from > 0 ? { from: doc.line(from).to, to: doc.length } : { from: 0, to: doc.length };
}

function lineChanges(doc: Text, { from, to, lines }: LineEdit): ChangeSpec[] {
  const paired = Math.min(to - from, lines.length);
  const changes = lines
    .slice(0, paired)
    .flatMap((next, index) => lineReplace(doc.line(from + index + 1), next));
  if (to - from === lines.length) {
    return changes;
  }
  const extra = { from: from + paired, to, lines: lines.slice(paired) };
  return [...changes, extraLines(doc, extra, paired > 0)];
}

function keyedEdits(doc: Text, { from, to, lines }: LineEdit): LineEdit[] {
  const oldKeys = Array.from({ length: to - from }, (_, index) =>
    doc.line(from + index + 1).text.replaceAll(/\s+/g, ""),
  );
  const nextKeys = lines.map((line) => line.replaceAll(/\s+/g, ""));
  const pieces: LineEdit[] = [];
  let oldAt = 0;
  let nextAt = 0;
  for (const unmatched of lineDiff(oldKeys, nextKeys)) {
    const nextFrom = nextAt + unmatched.from - oldAt;
    const nextTo = nextFrom + unmatched.lines.length;
    pieces.push(
      { from: from + oldAt, to: from + unmatched.from, lines: lines.slice(nextAt, nextFrom) },
      {
        from: from + unmatched.from,
        to: from + unmatched.to,
        lines: lines.slice(nextFrom, nextTo),
      },
    );
    oldAt = unmatched.to;
    nextAt = nextTo;
  }
  return [...pieces, { from: from + oldAt, to, lines: lines.slice(nextAt) }];
}

function lineByLine(edit: LineEdit): LineEdit[] {
  if (edit.to - edit.from !== edit.lines.length) {
    return [edit];
  }
  return edit.lines.map((line, index) => ({
    from: edit.from + index,
    to: edit.from + index + 1,
    lines: [line],
  }));
}

function openChangeLines(doc: Text, spans: readonly ChunkSpan[]): LeftAlone[] {
  return spans
    .filter(({ chunk, status }) => !isResolved(chunk, status))
    .map(({ from, to }) => {
      const firstIndex = doc.lineAt(from).number - 1;
      const after = doc.lineAt(to);
      return { first: firstIndex - 1, last: after.from === to ? after.number - 1 : after.number };
    });
}

export async function formatResult(
  open: Pick<OpenDocument, "format">,
  pane: () => ResultPane,
  field: StateField<readonly ChunkSpan[]>,
  closed: () => boolean,
): Promise<FormatOutcome> {
  const reply = await open.format(formattingOptions(pane().state));
  if (reply.kind !== "formatted") {
    return reply;
  }
  const { server } = reply;
  const { state } = pane();
  const { doc } = state;
  if (closed() || paneText(state) !== reply.sent) {
    return { kind: "changedMeanwhile", server };
  }
  const leftAlone = openChangeLines(doc, state.field(field));
  const changes = lineDiff(doc.toJSON(), reply.result.split(/\r\n?|\n/))
    .flatMap((edit) => keyedEdits(doc, edit))
    .flatMap((piece) => lineByLine(piece))
    .filter(({ from, to }) => leftAlone.every(({ first, last }) => from > last || to <= first))
    .flatMap((piece) => lineChanges(doc, piece));
  if (changes.length === 0) {
    return { kind: "unchanged", server };
  }
  pane().dispatch({ changes, userEvent: "yamt.format" });
  return { kind: "formatted", server };
}

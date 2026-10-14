import { indentUnit } from "@codemirror/language";
import {
  Text,
  type ChangeSpec,
  type EditorState,
  type Line,
  type TransactionSpec,
} from "@codemirror/state";

import type { FormatRefusal, FormattingOptions, OpenDocument } from "../../lsp";
import { lineDiff, type LineEdit } from "./lineDiff";
import { paneText } from "./pane";

export type FormatOutcome =
  | { readonly kind: "formatted" | "unchanged" | "changedMeanwhile"; readonly server: string }
  | FormatRefusal;

export type ResultPane = {
  readonly state: EditorState;
  dispatch(spec: TransactionSpec): void;
};

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

export async function formatResult(
  open: Pick<OpenDocument, "format">,
  pane: () => ResultPane,
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
  const edits = lineDiff(doc.toJSON(), reply.result.split(/\r\n?|\n/));
  if (edits.length === 0) {
    return { kind: "unchanged", server };
  }
  const changes = edits.flatMap((edit) => lineChanges(doc, edit));
  pane().dispatch({ changes, userEvent: "yamt.format" });
  return { kind: "formatted", server };
}

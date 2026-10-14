import { indentUnit } from "@codemirror/language";
import { Text, type ChangeSpec, type EditorState, type TransactionSpec } from "@codemirror/state";

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

function lineChange(doc: Text, { from, to, lines }: LineEdit): ChangeSpec {
  if (lines.length > 0 && to > from) {
    return { from: doc.line(from + 1).from, to: doc.line(to).to, insert: Text.of(lines) };
  }
  if (lines.length > 0) {
    return from < doc.lines
      ? { from: doc.line(from + 1).from, insert: Text.of([...lines, ""]) }
      : { from: doc.length, insert: Text.of(["", ...lines]) };
  }
  if (to < doc.lines) {
    return { from: doc.line(from + 1).from, to: doc.line(to + 1).from };
  }
  return from > 0 ? { from: doc.line(from).to, to: doc.length } : { from: 0, to: doc.length };
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
  const edits = lineDiff(doc.toJSON(), state.toText(reply.result).toJSON());
  if (edits.length === 0) {
    return { kind: "unchanged", server };
  }
  const changes = edits.map((edit) => lineChange(doc, edit));
  pane().dispatch({ changes, userEvent: "yamt.format" });
  return { kind: "formatted", server };
}

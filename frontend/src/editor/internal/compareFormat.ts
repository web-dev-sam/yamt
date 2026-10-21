import { isolateHistory } from "@codemirror/commands";
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";

import type { Column } from "../../ipc";
import { formatJson } from "./formatJson";
import type { FormatResult } from "./formatResult";
import { formatXml } from "./formatXml";

export const FORMAT_LANGUAGES = ["JSON", "XML"] as const;
export type FormatLanguage = (typeof FORMAT_LANGUAGES)[number];

export type ColumnFormat =
  | { readonly kind: "formatted" | "unchanged" }
  | { readonly kind: "failed"; readonly message: string; readonly line: number };
export type FormatReport = Readonly<Record<Column, ColumnFormat>>;

export type FormatTarget = {
  readonly state: EditorState;
  dispatch(spec: TransactionSpec): void;
};

const FORMATTERS: Readonly<Record<FormatLanguage, (text: string) => FormatResult>> = {
  JSON: formatJson,
  XML: formatXml,
};

export function isFormatLanguage(name: string): name is FormatLanguage {
  return Object.hasOwn(FORMATTERS, name);
}

function formatColumn(target: FormatTarget, language: FormatLanguage): ColumnFormat {
  const { doc } = target.state;
  const result = FORMATTERS[language](target.state.sliceDoc());
  if (result.kind !== "formatted") {
    return result;
  }
  target.dispatch({
    changes: { from: 0, to: doc.length, insert: result.text },
    selection: EditorSelection.cursor(0),
    userEvent: "yamt.format",
    annotations: isolateHistory.of("full"),
  });
  return { kind: target.state.doc === doc ? "unchanged" : "formatted" };
}

export function formatColumns(
  targets: Readonly<Record<Column, FormatTarget>>,
  language: FormatLanguage,
): FormatReport {
  const left = formatColumn(targets.left, language);
  const right = formatColumn(targets.right, language);
  return { left, right };
}

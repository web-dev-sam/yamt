import { EditorState, type Extension, type Text } from "@codemirror/state";

import type { FileMergeData } from "../../ipc";
import type { Pane } from "./geometry";

export function lineSeparator(eol: FileMergeData["eol"]): Extension {
  return eol === "CrLf" ? EditorState.lineSeparator.of("\r\n") : [];
}

function paneDoc(text: string, eol: FileMergeData["eol"]): Text {
  return EditorState.create({ doc: text, extensions: lineSeparator(eol) }).doc;
}

export function paneDocs(
  data: Pick<FileMergeData, "local" | "middle" | "remote" | "eol">,
): Readonly<Record<Pane, Text>> {
  return {
    left: paneDoc(data.local, data.eol),
    center: paneDoc(data.middle.kind === "DiskNotText" ? "" : data.middle.text, data.eol),
    right: paneDoc(data.remote, data.eol),
  };
}

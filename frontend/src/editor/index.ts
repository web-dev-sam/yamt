import type { EditorView } from "@codemirror/view";

import type { FileMergeData } from "../ipc";
import { chunkField } from "./internal/chunkField";
import { centerDecorations, sideDecorations } from "./internal/decorations";
import { createPane } from "./internal/pane";

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
};

export class MergeController {
  readonly #views: readonly EditorView[];

  constructor(data: FileMergeData, hosts: MergeHosts) {
    const { language, chunks } = data;
    const spans = chunkField(chunks);
    this.#views = [
      createPane({
        kind: "side",
        doc: data.local,
        language,
        parent: hosts.left,
        chunks: sideDecorations(chunks, "local"),
      }),
      createPane({
        kind: "center",
        doc: data.base,
        language,
        parent: hosts.center,
        chunks: [spans, centerDecorations(spans)],
      }),
      createPane({
        kind: "side",
        doc: data.remote,
        language,
        parent: hosts.right,
        chunks: sideDecorations(chunks, "remote"),
      }),
    ];
  }

  destroy(): void {
    for (const view of this.#views) {
      view.destroy();
    }
  }
}

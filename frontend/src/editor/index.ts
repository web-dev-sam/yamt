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
    const field = chunkField(chunks);
    this.#views = [
      createPane({
        kind: "side",
        doc: data.local,
        language,
        parent: hosts.left,
        decorations: sideDecorations(chunks, "local"),
      }),
      createPane({
        kind: "center",
        doc: data.base,
        language,
        parent: hosts.center,
        decorations: [field, centerDecorations(field)],
      }),
      createPane({
        kind: "side",
        doc: data.remote,
        language,
        parent: hosts.right,
        decorations: sideDecorations(chunks, "remote"),
      }),
    ];
  }

  destroy(): void {
    for (const view of this.#views) {
      view.destroy();
    }
  }
}

import type { EditorView } from "@codemirror/view";

import { createPane } from "./internal/pane";

export type MergeTexts = {
  readonly local: string;
  readonly base: string;
  readonly remote: string;
  readonly language: string | null;
};

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
};

export class MergeController {
  readonly #views: readonly EditorView[];

  constructor(texts: MergeTexts, hosts: MergeHosts) {
    const { language } = texts;
    this.#views = [
      createPane({ kind: "side", doc: texts.local, language, parent: hosts.left }),
      createPane({ kind: "center", doc: texts.base, language, parent: hosts.center }),
      createPane({ kind: "side", doc: texts.remote, language, parent: hosts.right }),
    ];
  }

  destroy(): void {
    for (const view of this.#views) {
      view.destroy();
    }
  }
}

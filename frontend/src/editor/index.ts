import { redo, undo } from "@codemirror/commands";
import type { Language, LanguageDescription, LanguageSupport } from "@codemirror/language";
import type { StateField } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import { log, type FileMergeData } from "../ipc";
import {
  applySteps,
  bulkApplySteps,
  dispatchSteps,
  ignoreSteps,
  type ApplyTarget,
  type SideDocs,
  type Steps,
  type VisibleLines,
} from "./internal/apply";
import { chunkField, type ChunkSpan } from "./internal/chunkField";
import { centerDecorations, sideDecorations } from "./internal/decorations";
import { chunkRows, type PaneViews } from "./internal/geometry";
import { languageOf } from "./internal/language";
import { createPane, languageCompartment, paneText } from "./internal/pane";
import { ScrollSync } from "./internal/scrollSync";
import type { Side } from "./internal/side";
import { showStatuses, sideStatusField } from "./internal/sideStatus";
import { summarize, type MergeSummary } from "./internal/status";
import { keepEditorFocus, paintStrips, type ChunkAction } from "./internal/strips";

export type { Side } from "./internal/side";
export type { MergeSummary } from "./internal/status";

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
  readonly strips: readonly [SVGSVGElement, SVGSVGElement];
};

type ViewSources = { data: FileMergeData; hosts: MergeHosts; language: Language | null };

export class MergeController {
  readonly #field: StateField<readonly ChunkSpan[]>;
  readonly #views: PaneViews;
  readonly #sides: SideDocs;
  readonly #strips: MergeHosts["strips"];
  readonly #scroll: ScrollSync;
  #frameId: number | null = null;
  #summaryListener: ((summary: MergeSummary) => void) | null = null;
  #destroyed = false;

  constructor(data: FileMergeData, hosts: MergeHosts) {
    const description = languageOf(data.path);
    this.#field = chunkField(data.chunks);
    this.#views = this.#createViews({
      data,
      hosts,
      language: description?.support?.language ?? null,
    });
    this.#sides = { local: this.#views.left.state.doc, remote: this.#views.right.state.doc };
    this.#strips = hosts.strips;
    for (const strip of this.#strips) {
      strip.addEventListener("mousedown", keepEditorFocus);
    }
    this.#scroll = new ScrollSync(this.#views, () => {
      this.#requestFrame();
    });
    this.#requestFrame();
    if (description !== null && description.support === undefined) {
      void this.#loadLanguage(description, data.path);
    }
  }

  async #loadLanguage(description: LanguageDescription, path: string): Promise<void> {
    let support: LanguageSupport;
    try {
      support = await description.load();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log.warn("language.load_failed", { path, language: description.name, reason });
      return;
    }
    if (this.#destroyed) {
      return;
    }
    const effects = languageCompartment.reconfigure(support.language);
    for (const view of [this.#views.left, this.#views.center, this.#views.right]) {
      view.dispatch({ effects });
    }
  }

  #createViews({ data, hosts, language }: ViewSources): PaneViews {
    const field = this.#field;
    const repaint = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.geometryChanged) {
        this.#requestFrame();
      }
    });
    const statusSync = EditorView.updateListener.of((update) => {
      this.#statusesChanged(update);
    });
    const shared = { eol: data.eol, language };
    const center = createPane({
      ...shared,
      kind: "center",
      doc: data.base,
      parent: hosts.center,
      extensions: [field, centerDecorations(field), repaint, statusSync],
    });
    const statuses = sideStatusField(
      center.state.field(field).map(({ chunk, status }) => ({ chunk, status })),
    );
    return {
      left: createPane({
        ...shared,
        kind: "side",
        doc: data.local,
        parent: hosts.left,
        extensions: [statuses, sideDecorations(statuses, "local"), repaint],
      }),
      center,
      right: createPane({
        ...shared,
        kind: "side",
        doc: data.remote,
        parent: hosts.right,
        extensions: [statuses, sideDecorations(statuses, "remote"), repaint],
      }),
    };
  }

  #target(): ApplyTarget {
    return { state: this.#views.center.state, field: this.#field, sides: this.#sides };
  }

  #dispatch(steps: Steps): void {
    dispatchSteps((spec) => {
      this.#views.center.dispatch(spec);
    }, steps);
  }

  #visibleLines(): VisibleLines {
    const view = this.#views.center;
    const top = view.scrollDOM.getBoundingClientRect().top - view.documentTop;
    const bottom = top + view.scrollDOM.clientHeight;
    const first = view.lineBlockAtHeight(top);
    const last = view.lineBlockAtHeight(bottom);
    const doc = view.state.doc;
    const firstLine = doc.lineAt(first.from).number;
    const lastLine = doc.lineAt(last.from).number;
    return {
      first: first.top < top && firstLine < lastLine ? firstLine + 1 : firstLine,
      last: last.bottom > bottom && lastLine > firstLine ? lastLine - 1 : lastLine,
    };
  }

  #stepsFor(action: ChunkAction): Steps {
    const request = { target: this.#target(), chunk: action.chunk, side: action.side };
    switch (action.kind) {
      case "apply":
        return applySteps(request);
      case "ignore":
        return ignoreSteps(request);
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  }

  #act(action: ChunkAction): void {
    this.#dispatch(this.#stepsFor(action));
    const center = this.#views.center;
    if (!center.hasFocus) {
      center.focus();
    }
  }

  #statusesChanged(update: ViewUpdate): void {
    const before = update.startState.field(this.#field);
    const after = update.state.field(this.#field);
    if (after.every((span, index) => span.status === before[index]?.status)) {
      return;
    }
    const states = after.map(({ chunk, status }) => ({ chunk, status }));
    this.#views.left.dispatch({ effects: showStatuses.of(states) });
    this.#views.right.dispatch({ effects: showStatuses.of(states) });
    this.#requestFrame();
    this.#summaryListener?.(summarize(after));
  }

  #requestFrame(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      const views = this.#views;
      const rows = chunkRows(views, views.center.state.field(this.#field));
      this.#scroll.sync(rows);
      paintStrips(views, this.#strips, rows, (action) => {
        this.#act(action);
      });
    });
  }

  applyAllNonConflicting(side: Side): void {
    this.#dispatch(bulkApplySteps({ target: this.#target(), side, visible: this.#visibleLines() }));
  }

  undo(): boolean {
    return undo(this.#views.center);
  }

  redo(): boolean {
    return redo(this.#views.center);
  }

  resultText(): string {
    return paneText(this.#views.center.state);
  }

  summary(): MergeSummary {
    return summarize(this.#views.center.state.field(this.#field));
  }

  onSummaryChange(listener: (summary: MergeSummary) => void): void {
    this.#summaryListener = listener;
  }

  destroy(): void {
    this.#summaryListener = null;
    this.#destroyed = true;
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
    }
    this.#scroll.destroy();
    for (const view of [this.#views.left, this.#views.center, this.#views.right]) {
      view.destroy();
    }
    for (const strip of this.#strips) {
      strip.removeEventListener("mousedown", keepEditorFocus);
      strip.replaceChildren();
    }
  }
}

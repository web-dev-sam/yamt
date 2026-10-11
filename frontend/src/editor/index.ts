import { redo, undo } from "@codemirror/commands";
import type { Language, LanguageDescription, LanguageSupport } from "@codemirror/language";
import { searchPanelOpen } from "@codemirror/search";
import type { Extension, StateField } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import { log, type FileMergeData } from "../ipc";
import {
  actionSteps,
  bulkApplySteps,
  dispatchSteps,
  type ApplyTarget,
  type ChunkAction,
  type SideDocs,
  type Steps,
  type VisibleLines,
} from "./internal/apply";
import { chunkField, type ChunkSpan } from "./internal/chunkField";
import { coveredDecorations, coveredField, sameCovered, showCovered } from "./internal/covered";
import { centerDecorations, sideDecorations } from "./internal/decorations";
import { coveredAction, IconDrag } from "./internal/drag";
import { findSpace, showFindSpace } from "./internal/find";
import { chunkRows, type ChunkRow, type PaneViews } from "./internal/geometry";
import { languageOf } from "./internal/language";
import { applyOnModClick } from "./internal/modClick";
import { createPane, languageCompartment, paneText } from "./internal/pane";
import { ScrollSync } from "./internal/scrollSync";
import type { Side } from "./internal/side";
import { showStatuses, sideStatusField } from "./internal/sideStatus";
import { summarize, type ChunkState, type MergeSummary } from "./internal/status";
import { keepEditorFocus, paintStrips, type IconPress } from "./internal/strips";

export type { Side } from "./internal/side";
export type { MergeSummary } from "./internal/status";

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
  readonly strips: readonly [SVGSVGElement, SVGSVGElement];
};

export type MergeOptions = { readonly readOnly: boolean };

type ViewSources = { data: FileMergeData; hosts: MergeHosts; language: Language | null };

export class MergeController {
  readonly #field: StateField<readonly ChunkSpan[]>;
  readonly #readOnly: boolean;
  readonly #views: PaneViews;
  readonly #sides: SideDocs;
  readonly #strips: MergeHosts["strips"];
  readonly #scroll: ScrollSync;
  readonly #drag: IconDrag;
  #frameId: number | null = null;
  #summaryListener: ((summary: MergeSummary) => void) | null = null;
  #destroyed = false;

  constructor(data: FileMergeData, hosts: MergeHosts, options?: MergeOptions) {
    const description = languageOf(data.path);
    this.#field = chunkField(data.chunks);
    this.#readOnly = options?.readOnly ?? false;
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
    this.#drag = new IconDrag(this.#strips, {
      changed: () => {
        this.#requestFrame();
      },
      released: (press) => {
        this.#act(coveredAction(press, this.#rows(), this.#views));
      },
    });
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

  readonly #repaint = EditorView.updateListener.of((update) => {
    if (
      update.docChanged ||
      update.geometryChanged ||
      searchPanelOpen(update.startState) !== searchPanelOpen(update.state)
    ) {
      this.#requestFrame();
    }
  });

  #createViews({ data, hosts, language }: ViewSources): PaneViews {
    const field = this.#field;
    const statusSync = EditorView.updateListener.of((update) => {
      this.#statusesChanged(update);
    });
    const shared = { eol: data.eol, language };
    const center = createPane({
      ...shared,
      kind: this.#readOnly ? "readOnlyCenter" : "center",
      doc: data.base,
      parent: hosts.center,
      extensions: [field, centerDecorations(field), this.#repaint, statusSync],
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
        extensions: this.#sideExtensions(statuses, "local"),
      }),
      center,
      right: createPane({
        ...shared,
        kind: "side",
        doc: data.remote,
        parent: hosts.right,
        extensions: this.#sideExtensions(statuses, "remote"),
      }),
    };
  }

  #sideExtensions(statuses: StateField<readonly ChunkState[]>, side: Side): Extension {
    return [
      statuses,
      sideDecorations(statuses, side),
      coveredDecorations(side),
      this.#repaint,
      this.#readOnly
        ? []
        : applyOnModClick(statuses, side, (chunk) => {
            this.#act({ kind: "apply", side, chunks: [chunk] });
          }),
    ];
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

  #act(action: ChunkAction): void {
    this.#dispatch(actionSteps(this.#target(), action));
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

  #rows(): ChunkRow[] {
    return chunkRows(this.#views, this.#views.center.state.field(this.#field));
  }

  #showCovered(covered: ChunkAction | null): void {
    if (sameCovered(covered, this.#views.left.state.field(coveredField))) {
      return;
    }
    this.#views.left.dispatch({ effects: showCovered.of(covered) });
    this.#views.right.dispatch({ effects: showCovered.of(covered) });
  }

  #showFindSpace(): void {
    const views = [this.#views.left, this.#views.center, this.#views.right];
    const shown = views.some((view) => searchPanelOpen(view.state));
    for (const view of views) {
      if (view.state.field(findSpace) !== shown) {
        view.dispatch({ effects: showFindSpace.of(shown) });
      }
    }
  }

  readonly #press = (press: IconPress, event: PointerEvent): void => {
    this.#drag.start(press, event);
  };

  #requestFrame(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      this.#showFindSpace();
      const rows = this.#rows();
      this.#scroll.sync(rows);
      const press = this.#drag.press;
      const covered = press === null ? null : coveredAction(press, rows, this.#views);
      this.#showCovered(covered);
      paintStrips(this.#views, this.#strips, rows, {
        covered,
        onPress: this.#readOnly ? null : this.#press,
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
    this.#drag.destroy();
    for (const view of [this.#views.left, this.#views.center, this.#views.right]) {
      view.destroy();
    }
    for (const strip of this.#strips) {
      strip.removeEventListener("mousedown", keepEditorFocus);
      strip.replaceChildren();
    }
  }
}

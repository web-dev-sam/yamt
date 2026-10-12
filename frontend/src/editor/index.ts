import { redo, undo } from "@codemirror/commands";
import type { Language, LanguageDescription, LanguageSupport } from "@codemirror/language";
import { searchPanelOpen } from "@codemirror/search";
import type { Extension, StateField } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import { log, type FileMergeData } from "../ipc";
import { actionSteps, bulkApplySteps, dispatchSteps, type ApplyTarget } from "./internal/apply";
import type { ChunkAction, SideDocs, Steps } from "./internal/apply";
import { chunkField, type ChunkSpan } from "./internal/chunkField";
import { coveredDecorations, coveredField, sameCovered, showCovered } from "./internal/covered";
import { centerDecorations, focusDecorations, sideDecorations } from "./internal/decorations";
import { coveredAction, IconDrag } from "./internal/drag";
import { syncFindSpace } from "./internal/find";
import { chunkRows, rowsChanged, type ChunkRow, type PaneViews } from "./internal/geometry";
import { historyCommand } from "./internal/historyKey";
import { languageOf } from "./internal/language";
import { applyOnModClick } from "./internal/modClick";
import { centerPane, createPane, languageCompartment, paneText } from "./internal/pane";
import { anchorsOf, contentEnds, ScrollSync, type Anchor } from "./internal/scrollSync";
import type { Side } from "./internal/side";
import { sideKeys, SideFocus } from "./internal/sideFocus";
import { showStatuses, sideStatusField } from "./internal/sideStatus";
import { summarize, type ChunkState, type MergeSummary } from "./internal/status";
import { Strips, type IconPress } from "./internal/strips";
import { visibleLines } from "./internal/viewport";

export type { Side } from "./internal/side";
export type { MergeSummary } from "./internal/status";

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
  readonly strips: readonly [SVGSVGElement, SVGSVGElement];
};

export type MergeOptions = { readonly readOnly: boolean };

type ViewSources = {
  data: FileMergeData;
  hosts: MergeHosts;
  language: Language | null;
};
type Layout = { readonly rows: readonly ChunkRow[]; readonly anchors: readonly Anchor[] };

export class MergeController {
  readonly #field: StateField<readonly ChunkSpan[]>;
  readonly #readOnly: boolean;
  readonly #views: PaneViews;
  readonly #sides: SideDocs;
  readonly #strips: Strips;
  readonly #scroll: ScrollSync;
  readonly #drag: IconDrag;
  readonly #focus: SideFocus;
  #frameId: number | null = null;
  #layoutCache: Layout | null = null;
  #summaryListener: ((summary: MergeSummary) => void) | null = null;
  #destroyed = false;

  constructor(data: FileMergeData, hosts: MergeHosts, options?: MergeOptions) {
    const description = languageOf(data.path);
    this.#field = chunkField(data.chunks);
    this.#readOnly = options?.readOnly ?? false;
    const language = description?.support?.language ?? null;
    this.#views = this.#createViews({ data, hosts, language });
    this.#focus = new SideFocus({
      views: this.#views,
      states: () => this.#views.center.state.field(this.#field),
      rows: () => this.#layout().rows,
      decide: (action) => this.#decide(action),
      readOnly: this.#readOnly,
      hidden: data.deleted,
    });
    this.#sides = { local: this.#views.left.state.doc, remote: this.#views.right.state.doc };
    this.#strips = new Strips(hosts.strips, this.#readOnly ? null : this.#press);
    this.#drag = new IconDrag(hosts.strips, {
      changed: () => {
        this.#requestFrame();
      },
      released: (press) => {
        this.#act(coveredAction(press, this.#layout().rows, this.#views));
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
    if (rowsChanged(update, this.#field)) {
      this.#layoutCache = null;
    }
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
      ...centerPane(data.middle, this.#readOnly),
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
      focusDecorations(statuses, side),
      coveredDecorations(side),
      sideKeys((command) => {
        this.#focus.run(side, command);
      }),
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

  #decide(action: ChunkAction): void {
    this.#focus.deciding(() => {
      this.#dispatch(actionSteps(this.#target(), action));
    });
  }

  #act(action: ChunkAction): void {
    this.#decide(action);
    const { left, center, right } = this.#views;
    if (!left.hasFocus && !center.hasFocus && !right.hasFocus) {
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

  #layout(): Layout {
    if (this.#layoutCache === null) {
      const rows = chunkRows(this.#views, this.#views.center.state.field(this.#field));
      this.#layoutCache = { rows, anchors: anchorsOf(rows, contentEnds(this.#views)) };
    }
    return this.#layoutCache;
  }

  #showCovered(covered: ChunkAction | null): void {
    if (sameCovered(covered, this.#views.left.state.field(coveredField))) {
      return;
    }
    this.#views.left.dispatch({ effects: showCovered.of(covered) });
    this.#views.right.dispatch({ effects: showCovered.of(covered) });
  }

  readonly #press = (press: IconPress, event: PointerEvent): void => {
    this.#drag.start(press, event);
  };

  #requestFrame(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      syncFindSpace(this.#views);
      const { rows, anchors } = this.#layout();
      this.#scroll.sync(anchors);
      const press = this.#drag.press;
      const covered = press === null ? null : coveredAction(press, rows, this.#views);
      this.#showCovered(covered);
      this.#strips.paint(this.#views, rows, covered);
    });
  }

  applyAllNonConflicting(side: Side): void {
    this.#dispatch(
      bulkApplySteps({ target: this.#target(), side, visible: visibleLines(this.#views.center) }),
    );
  }

  undo(): boolean {
    return undo(this.#views.center);
  }

  redo(): boolean {
    return redo(this.#views.center);
  }

  historyKey(event: KeyboardEvent): boolean {
    const command = historyCommand(event, navigator.platform);
    if (command === null) {
      return false;
    }
    event.preventDefault();
    return command === "undo" ? this.undo() : this.redo();
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
    this.#focus.destroy();
    this.#drag.destroy();
    for (const view of [this.#views.left, this.#views.center, this.#views.right]) {
      view.destroy();
    }
    this.#strips.destroy();
  }
}

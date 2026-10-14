import { redo, undo } from "@codemirror/commands";
import type { StateField } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import type { FileMergeData } from "../ipc";
import type { LanguageServers } from "../lsp";
import { actionSteps, bulkApplySteps, dispatchSteps, type ApplyTarget } from "./internal/apply";
import type { ChunkAction, Reach, SideDocs, Steps } from "./internal/apply";
import { chunkField, type ChunkSpan } from "./internal/chunkField";
import { coveredAction, IconDrag } from "./internal/drag";
import { foldRuns } from "./internal/foldRuns";
import { Folds } from "./internal/foldView";
import type { FormatOutcome } from "./internal/format";
import { Frame } from "./internal/frame";
import type { PaneViews } from "./internal/geometry";
import { historyCommand } from "./internal/historyKey";
import { languageOf, loadLanguage } from "./internal/language";
import type { Direction } from "./internal/navigation";
import { preferenceEffects } from "./internal/pane";
import type { PaneSettings, Preferences } from "./internal/pane";
import { paneDocs } from "./internal/paneDocs";
import { createPaneViews, type ViewSources } from "./internal/paneViews";
import { problemCounts, problemsField, type ProblemCounts } from "./internal/problems";
import { SavedPoint, type ResultSnapshot } from "./internal/savedPoint";
import { openResult, type ServerDoc } from "./internal/serverDoc";
import type { Side } from "./internal/side";
import { SideFocus } from "./internal/sideFocus";
import { showStatuses } from "./internal/sideStatus";
import { summarize, type MergeSummary } from "./internal/status";
import type { IconPress } from "./internal/stripIcons";
import { Strips } from "./internal/strips";
import { visibleLines } from "./internal/viewport";

export type { Direction } from "./internal/navigation";
export type { FormatOutcome } from "./internal/format";
export type { Preferences } from "./internal/pane";
export type { ProblemCounts } from "./internal/problems";
export type { ResultSnapshot } from "./internal/savedPoint";
export type { Side } from "./internal/side";
export type { MergeSummary } from "./internal/status";

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
  readonly strips: readonly [SVGSVGElement, SVGSVGElement];
};

export type MergeOptions = {
  readonly readOnly: boolean;
  readonly preferences: Preferences;
  readonly collapsed: boolean;
  readonly servers: LanguageServers | null;
};

export class MergeController {
  readonly #field: StateField<readonly ChunkSpan[]>;
  readonly #folds: Folds;
  readonly #readOnly: boolean;
  #settings: PaneSettings;
  readonly #views: PaneViews;
  readonly #sides: SideDocs;
  readonly #strips: Strips;
  readonly #drag: IconDrag;
  readonly #focus: SideFocus;
  readonly #frame: Frame;
  readonly #server: ServerDoc | null;
  readonly #saved: SavedPoint;
  #summaryListener: ((summary: MergeSummary) => void) | null = null;
  #destroyed = false;

  constructor(data: FileMergeData, hosts: MergeHosts, options: MergeOptions) {
    const description = languageOf(data.path);
    const docs = paneDocs(data);
    this.#field = chunkField(data.chunks);
    const runs = foldRuns(data.chunks, docs);
    this.#folds = new Folds(runs, hosts, () => this.#views, options.collapsed);
    this.#readOnly = options.readOnly;
    this.#settings = { preferences: options.preferences, platform: navigator.platform };
    const language = description?.support?.language ?? null;
    this.#views = this.#createViews({ data, docs, hosts, language });
    this.#focus = this.#createFocus(data.deleted);
    this.#sides = { local: docs.left, remote: docs.right };
    const center = () => this.#views.center.state;
    this.#saved = new SavedPoint({ field: this.#field, sides: this.#sides, current: center });
    const press = this.#readOnly ? null : this.#press;
    this.#strips = new Strips(hosts.strips, press, this.#folds.hovered);
    this.#drag = this.#createDrag(hosts.strips);
    this.#frame = new Frame({
      views: this.#views,
      spans: this.#field,
      folds: this.#folds.fields,
      drag: this.#drag,
      strips: this.#strips,
    });
    this.#frame.request();
    if (description !== null && description.support === undefined) {
      void loadLanguage(description, data.path, this.#views, () => this.#destroyed);
    }
    const result = { path: data.path, readOnly: this.#readOnly };
    this.#server = openResult(options.servers, result, () => this.#views, this.#field);
  }

  readonly #repaint = EditorView.updateListener.of((update) => {
    this.#frame.changed(update);
  });

  readonly #statusSync = EditorView.updateListener.of((update) => {
    this.#statusesChanged(update);
  });

  readonly #serverSync = EditorView.updateListener.of((update) => {
    this.#server?.updated(update);
  });

  readonly #savedSync = EditorView.updateListener.of((update) => {
    this.#saved.updated(update);
  });

  #createViews(sources: ViewSources): PaneViews {
    return createPaneViews(sources, {
      field: this.#field,
      folds: this.#folds,
      readOnly: this.#readOnly,
      settings: this.#settings,
      center: [this.#repaint, this.#statusSync, problemsField, this.#serverSync, this.#savedSync],
      repaint: this.#repaint,
      run: (side, command) => {
        this.#focus.run(side, command);
      },
      rows: () => this.#frame.layout().rows,
      act: (action) => {
        this.#act(action, "side");
      },
    });
  }

  #createFocus(hidden: Side | null): SideFocus {
    return new SideFocus({
      views: this.#views,
      states: () => this.#views.center.state.field(this.#field),
      rows: () => this.#frame.layout().rows,
      decide: (action) => this.#decide(action, "side"),
      readOnly: this.#readOnly,
      hidden,
    });
  }

  #createDrag(strips: MergeHosts["strips"]): IconDrag {
    return new IconDrag(strips, {
      changed: () => {
        this.#frame.request();
      },
      released: (press, reach) => {
        this.#act(coveredAction(press, this.#frame.layout().rows, this.#views), reach);
      },
    });
  }

  #target(): ApplyTarget {
    return { state: this.#views.center.state, field: this.#field, sides: this.#sides };
  }

  #dispatch(steps: Steps): void {
    dispatchSteps((spec) => {
      this.#views.center.dispatch(spec);
    }, steps);
  }

  #decide(action: ChunkAction, reach: Reach): void {
    this.#focus.deciding(() => {
      this.#dispatch(actionSteps(this.#target(), action, reach));
    });
  }

  #act(action: ChunkAction, reach: Reach): void {
    this.#decide(action, reach);
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
    this.#frame.request();
    this.#summaryListener?.(summarize(after));
  }

  readonly #press = (press: IconPress, event: PointerEvent): void => {
    this.#drag.start(press, event);
  };

  applyAllNonConflicting(side: Side): void {
    this.#dispatch(
      bulkApplySteps({ target: this.#target(), side, visible: visibleLines(this.#views.center) }),
    );
  }

  moveToChange(direction: Direction): void {
    this.#focus.moveToChange(direction);
  }

  setPreferences(preferences: Preferences): void {
    this.#settings = { ...this.#settings, preferences };
    const { left, center, right } = this.#views;
    center.dispatch({ effects: preferenceEffects("center", this.#settings) });
    for (const side of [left, right]) {
      side.dispatch({ effects: preferenceEffects("side", this.#settings) });
    }
  }

  setCollapsed(collapsed: boolean): void {
    this.#folds.setCollapsed(collapsed);
    this.#frame.realign();
  }

  undo(): boolean {
    return undo(this.#views.center);
  }

  redo(): boolean {
    return redo(this.#views.center);
  }

  historyKey(event: KeyboardEvent): boolean {
    const { preferences, platform } = this.#settings;
    const command = historyCommand(event, platform, preferences.keys);
    if (command === null) {
      return false;
    }
    event.preventDefault();
    return command === "undo" ? this.undo() : this.redo();
  }

  snapshot(): ResultSnapshot {
    return this.#saved.snapshot();
  }

  onUnsavedChange(listener: (unsaved: boolean) => void): void {
    this.#saved.onUnsavedChange(listener);
  }

  summary(): MergeSummary {
    return summarize(this.#views.center.state.field(this.#field));
  }

  onSummaryChange(listener: (summary: MergeSummary) => void): void {
    this.#summaryListener = listener;
  }

  format(): Promise<FormatOutcome> {
    return this.#server?.format() ?? Promise.resolve({ kind: "noFormatter" });
  }

  problems(): ProblemCounts {
    return problemCounts(this.#views.center.state);
  }

  onProblemsChange(listener: (counts: ProblemCounts) => void): void {
    this.#server?.onProblemsChange(listener);
  }

  destroy(): void {
    this.#summaryListener = null;
    this.#saved.onUnsavedChange(null);
    this.#destroyed = true;
    this.#server?.close();
    this.#frame.destroy();
    this.#folds.destroy();
    this.#focus.destroy();
    this.#drag.destroy();
    for (const view of [this.#views.left, this.#views.center, this.#views.right]) {
      view.destroy();
    }
    this.#strips.destroy();
  }
}

import { redo, undo } from "@codemirror/commands";
import type { Language } from "@codemirror/language";
import type { Extension, StateField, Text } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import type { FileMergeData } from "../ipc";
import { actionSteps, bulkApplySteps, dispatchSteps, type ApplyTarget } from "./internal/apply";
import type { ChunkAction, Reach, SideDocs, Steps } from "./internal/apply";
import { chunkField, type ChunkSpan } from "./internal/chunkField";
import { coveredDecorations } from "./internal/covered";
import { centerDecorations, focusDecorations, sideDecorations } from "./internal/decorations";
import { coveredAction, IconDrag } from "./internal/drag";
import { Folding } from "./internal/folding";
import { foldRuns, type Fold } from "./internal/foldRuns";
import { foldField, pushFolds, showNextStep, sideFoldField, sideReveals } from "./internal/folds";
import { foldView } from "./internal/foldView";
import { Frame } from "./internal/frame";
import { SIDE_PANE, type Pane, type PaneViews } from "./internal/geometry";
import { historyCommand } from "./internal/historyKey";
import { languageOf, loadLanguage } from "./internal/language";
import { modClicks } from "./internal/modClick";
import type { Direction } from "./internal/navigation";
import { centerPane, createPane, paneText, preferenceEffects } from "./internal/pane";
import type { PaneSettings, Preferences } from "./internal/pane";
import { paneDocs } from "./internal/paneDocs";
import type { Side } from "./internal/side";
import { SideFocus } from "./internal/sideFocus";
import { sideRunner } from "./internal/sideKeys";
import { showStatuses, sideStatusField } from "./internal/sideStatus";
import { summarize, type ChunkState, type MergeSummary } from "./internal/status";
import { Strips, type IconPress } from "./internal/strips";
import { visibleLines } from "./internal/viewport";

export type { Direction } from "./internal/navigation";
export type { Preferences } from "./internal/pane";
export type { Side } from "./internal/side";
export type { MergeSummary } from "./internal/status";

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
  readonly strips: readonly [SVGSVGElement, SVGSVGElement];
};

export type MergeOptions = { readonly readOnly: boolean; readonly preferences: Preferences };

type ViewSources = {
  data: FileMergeData;
  docs: Readonly<Record<Pane, Text>>;
  hosts: MergeHosts;
  language: Language | null;
};

export class MergeController {
  readonly #field: StateField<readonly ChunkSpan[]>;
  readonly #folds: Readonly<Record<"center" | "sides", StateField<readonly Fold[]>>>;
  readonly #readOnly: boolean;
  #settings: PaneSettings;
  readonly #views: PaneViews;
  readonly #sides: SideDocs;
  readonly #strips: Strips;
  readonly #drag: IconDrag;
  readonly #focus: SideFocus;
  readonly #folding: Folding;
  readonly #frame: Frame;
  #summaryListener: ((summary: MergeSummary) => void) | null = null;
  #destroyed = false;

  constructor(data: FileMergeData, hosts: MergeHosts, options: MergeOptions) {
    const description = languageOf(data.path);
    const docs = paneDocs(data);
    const runs = foldRuns(data.chunks, docs);
    this.#field = chunkField(data.chunks);
    this.#folds = { center: foldField(runs), sides: sideFoldField(runs) };
    this.#readOnly = options.readOnly;
    this.#settings = { preferences: options.preferences, platform: navigator.platform };
    const language = description?.support?.language ?? null;
    this.#folding = new Folding([hosts.left, hosts.center, hosts.right, ...hosts.strips], (run) => {
      const center = this.#views.center;
      center.dispatch(showNextStep(center.state.field(this.#folds.center), run));
    });
    this.#views = this.#createViews({ data, docs, hosts, language });
    this.#focus = this.#createFocus(data.deleted);
    this.#sides = { local: docs.left, remote: docs.right };
    this.#strips = new Strips(hosts.strips, this.#readOnly ? null : this.#press);
    this.#drag = this.#createDrag(hosts.strips);
    this.#frame = new Frame({
      views: this.#views,
      spans: this.#field,
      layoutFields: [this.#field, this.#folds.center, this.#folds.sides],
      drag: this.#drag,
      strips: this.#strips,
    });
    this.#frame.request();
    if (description !== null && description.support === undefined) {
      void loadLanguage(description, data.path, this.#views, () => this.#destroyed);
    }
  }

  readonly #repaint = EditorView.updateListener.of((update) => {
    this.#frame.changed(update);
  });

  readonly #statusSync = EditorView.updateListener.of((update) => {
    this.#statusesChanged(update);
  });

  #createViews({ data, docs, hosts, language }: ViewSources): PaneViews {
    const shared = { eol: data.eol, language, settings: this.#settings };
    const center = createPane({
      ...shared,
      kind: centerPane(data.middle, this.#readOnly).kind,
      doc: docs.center,
      parent: hosts.center,
      extensions: [
        this.#field,
        centerDecorations(this.#field),
        this.#folds.center,
        foldView(this.#folds.center, "center", () => this.#folding.hovered()),
        pushFolds(this.#folds.center, this.#folds.sides, () => this.#views),
        this.#repaint,
        this.#statusSync,
      ],
    });
    const statuses = sideStatusField(
      center.state.field(this.#field).map(({ chunk, status }) => ({ chunk, status })),
    );
    return {
      left: createPane({
        ...shared,
        kind: "side",
        doc: docs.left,
        parent: hosts.left,
        extensions: this.#sideExtensions(statuses, "local"),
      }),
      center,
      right: createPane({
        ...shared,
        kind: "side",
        doc: docs.right,
        parent: hosts.right,
        extensions: this.#sideExtensions(statuses, "remote"),
      }),
    };
  }

  #sideExtensions(statuses: StateField<readonly ChunkState[]>, side: Side): Extension {
    const pane = SIDE_PANE[side];
    return [
      statuses,
      sideDecorations(statuses, side),
      focusDecorations(statuses, side),
      coveredDecorations(side),
      this.#folds.sides,
      foldView(this.#folds.sides, pane, () => this.#folding.hovered()),
      sideReveals(this.#folds.sides, pane, () => this.#views.center),
      sideRunner.of((command) => {
        this.#focus.run(side, command);
      }),
      this.#repaint,
      this.#readOnly
        ? []
        : modClicks(side, {
            rows: () => this.#frame.layout().rows,
            act: (action) => {
              this.#act(action, "side");
            },
          }),
    ];
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
    this.#frame.destroy();
    this.#folding.destroy();
    this.#focus.destroy();
    this.#drag.destroy();
    for (const view of [this.#views.left, this.#views.center, this.#views.right]) {
      view.destroy();
    }
    this.#strips.destroy();
  }
}

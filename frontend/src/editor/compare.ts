import { redo, undo } from "@codemirror/commands";
import type { ViewUpdate } from "@codemirror/view";

import type { Column, ColumnVersion, Comparison, TabLanguage, TabTexts } from "../ipc";
import { showDifferences } from "./internal/compareFields";
import { formatColumns, type FormatLanguage, type FormatReport } from "./internal/compareFormat";
import { CompareFrame } from "./internal/compareFrame";
import { CompareLanguage } from "./internal/compareLanguage";
import { columnMarks } from "./internal/compareMarks";
import { Settle } from "./internal/compareSettle";
import { CompareStrip } from "./internal/compareStrip";
import {
  COLUMNS,
  createColumnViews,
  keyboardColumn,
  revealDifference,
} from "./internal/compareViews";
import type { ColumnViews } from "./internal/compareViews";
import { historyCommand } from "./internal/historyKey";
import type { Direction } from "./internal/navigation";
import { preferenceEffects, type PaneSettings, type Preferences } from "./internal/pane";

export type { ColumnFormat, FormatReport } from "./internal/compareFormat";
export { FORMAT_LANGUAGES } from "./internal/compareFormat";
export { languageNames } from "./internal/language";

export type CompareHosts = {
  readonly left: HTMLElement;
  readonly right: HTMLElement;
  readonly strip: SVGSVGElement;
};

export type CompareOptions = {
  readonly preferences: Preferences;
  readonly language: TabLanguage;
  readonly columnLimit: number;
};

export type ColumnText = {
  readonly column: Column;
  readonly text: string;
  readonly version: ColumnVersion;
};

export type CompareEvents = {
  readonly settled: (columns: readonly ColumnText[]) => void;
  readonly detected: (language: string | null) => void;
  readonly refused: (column: Column) => void;
};

const NOTHING_FORMATTED: FormatReport = {
  left: { kind: "unchanged" },
  right: { kind: "unchanged" },
};

export class CompareController {
  readonly #events: CompareEvents;
  readonly #settle: Settle;
  readonly #views: ColumnViews;
  readonly #strip: CompareStrip;
  readonly #frame: CompareFrame;
  readonly #language: CompareLanguage;
  #settings: PaneSettings;

  constructor(
    texts: TabTexts,
    hosts: CompareHosts,
    options: CompareOptions,
    events: CompareEvents,
  ) {
    this.#events = events;
    this.#settings = { preferences: options.preferences, platform: navigator.platform };
    this.#settle = new Settle(texts.comparison.versions, (columns) => {
      this.#settled(columns);
    });
    this.#views = createColumnViews(texts, hosts, {
      settings: this.#settings,
      columnLimit: options.columnLimit,
      refused: events.refused,
      updated: (column, update) => {
        this.#updated(column, update);
      },
    });
    this.#strip = new CompareStrip(hosts.strip);
    this.#frame = new CompareFrame({ views: this.#views, strip: this.#strip });
    this.showComparison(texts.comparison);
    this.#language = new CompareLanguage(options.language, this.#views, events.detected);
    this.#frame.request();
  }

  #updated(column: Column, update: ViewUpdate): void {
    if (update.docChanged) {
      this.#settle.edited(column);
    }
    this.#frame.changed(update);
  }

  #settled(columns: readonly Column[]): void {
    this.#events.settled(columns.map((column) => this.#columnText(column)));
    this.#language.settled();
  }

  #columnText(column: Column): ColumnText {
    const text = this.#views[column].state.sliceDoc();
    return { column, text, version: this.#settle.versions()[column] };
  }

  showComparison(comparison: Comparison): boolean {
    if (!this.#settle.accepts(comparison.versions)) {
      return false;
    }
    for (const column of COLUMNS) {
      const view = this.#views[column];
      const marks = columnMarks(view.state.doc, comparison.differences, column);
      view.dispatch({ effects: showDifferences.of(marks) });
    }
    return true;
  }

  setLanguage(language: TabLanguage): void {
    this.#language.set(language);
  }

  setPreferences(preferences: Preferences): void {
    this.#settings = { ...this.#settings, preferences };
    const effects = preferenceEffects("center", this.#settings);
    for (const column of COLUMNS) {
      this.#views[column].dispatch({ effects });
    }
  }

  formatLanguage(): FormatLanguage | null {
    return this.#language.formatLanguage();
  }

  format(): FormatReport {
    const language = this.formatLanguage();
    return language === null ? NOTHING_FORMATTED : formatColumns(this.#views, language);
  }

  moveToChange(direction: Direction): void {
    revealDifference(this.#views[keyboardColumn(this.#views) ?? "left"], direction);
  }

  historyKey(event: KeyboardEvent): boolean {
    const column = keyboardColumn(this.#views);
    const { preferences, platform } = this.#settings;
    const command = column === null ? null : historyCommand(event, platform, preferences.keys);
    if (column === null || command === null) {
      return false;
    }
    event.preventDefault();
    return command === "undo" ? undo(this.#views[column]) : redo(this.#views[column]);
  }

  holdsText(): boolean {
    return COLUMNS.some((column) => this.#views[column].state.doc.length > 0);
  }

  settleNow(): readonly ColumnText[] {
    return this.#settle.settleNow().map((column) => this.#columnText(column));
  }

  destroy(): void {
    this.#settle.destroy();
    this.#language.destroy();
    this.#frame.destroy();
    for (const column of COLUMNS) {
      this.#views[column].destroy();
    }
    this.#strip.destroy();
  }
}

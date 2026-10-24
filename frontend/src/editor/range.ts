import type { EditorView } from "@codemirror/view";

import type { Difference, ThreadLine } from "../ipc";
import type { CompareHosts } from "./compare";
import { differenceField } from "./internal/compareFields";
import { moveToDifference } from "./internal/compareFocus";
import { CompareFrame } from "./internal/compareFrame";
import { CompareStrip } from "./internal/compareStrip";
import {
  COLUMNS,
  createReadOnlyColumnViews,
  setColumnPreferences,
  showColumnDifferences,
  type ColumnViews,
} from "./internal/compareViews";
import { languageOf, loadLanguage } from "./internal/language";
import type { Direction } from "./internal/navigation";
import type { PaneSettings, Preferences } from "./internal/pane";
import { showThreadRows, threadAnchors, threadField } from "./internal/threadField";
import { ThreadHosts } from "./internal/threadHosts";
import { lineCounts, numberPress, threadNumbers } from "./internal/threadNumbers";
import { threadRows, type ShownThread } from "./internal/threadRows";

export type { ShownThread } from "./internal/threadRows";

export type RangeTexts = {
  readonly path: string; // the file's path in the range, the old path when deleted: picks the language
  readonly left: string;
  readonly right: string;
  readonly differences: readonly Difference[];
};

export type RangeOptions = { readonly preferences: Preferences };

export type RangeEvents = {
  readonly startThread: (line: ThreadLine) => void;
  readonly toggleThreads: (keys: readonly string[]) => void;
  readonly hosts: (hosts: ReadonlyMap<string, HTMLElement>) => void;
};

const NO_EVENTS: RangeEvents = {
  startThread: () => {},
  toggleThreads: () => {},
  hosts: () => {},
};

export class RangeController {
  readonly #differences: readonly Difference[];
  readonly #events: RangeEvents;
  readonly #threadHosts: ThreadHosts;
  readonly #views: ColumnViews;
  readonly #strip: CompareStrip;
  readonly #frame: CompareFrame;
  #settings: PaneSettings;
  #destroyed = false;

  constructor(
    texts: RangeTexts,
    hosts: CompareHosts,
    options: RangeOptions,
    events: RangeEvents = NO_EVENTS,
  ) {
    this.#differences = texts.differences;
    this.#events = events;
    this.#settings = { preferences: options.preferences, platform: navigator.platform };
    this.#threadHosts = new ThreadHosts({ views: () => this.#views, columns: hosts });
    this.#views = createReadOnlyColumnViews(texts, hosts, {
      settings: this.#settings,
      updated: (_column, update) => {
        this.#threadHosts.restoreFocus();
        this.#frame.changed(update);
      },
      extensions: [
        threadField,
        threadNumbers((view, line, onBadge) => {
          this.#pressed(view, line, onBadge);
        }),
      ],
    });
    this.#threadHosts.watchColumns();
    this.#strip = new CompareStrip(hosts.strip);
    this.#frame = new CompareFrame({
      views: this.#views,
      strip: this.#strip,
      fields: [differenceField, threadField],
      anchors: threadAnchors,
    });
    showColumnDifferences(this.#views, texts.differences);
    const description = languageOf(texts.path);
    if (description !== null) {
      const { left, right } = this.#views;
      void loadLanguage(description, texts.path, [left, right], () => this.#destroyed);
    }
    this.#frame.request();
  }

  #pressed(view: EditorView, line: number, onBadge: boolean): void {
    const column = view === this.#views.left ? "left" : "right";
    const counts = view.state.field(threadField)?.counts ?? [];
    const press = numberPress({ differences: this.#differences, column, line, onBadge, counts });
    if (press.kind === "start") {
      this.#events.startThread(press.line);
    } else {
      this.#events.toggleThreads(press.keys);
    }
  }

  setPreferences(preferences: Preferences): void {
    this.#settings = { ...this.#settings, preferences };
    setColumnPreferences(this.#views, this.#settings);
  }

  moveToChange(direction: Direction): void {
    moveToDifference(this.#views, direction);
  }

  showThreads(threads: readonly ShownThread[]): void {
    const rows = threadRows(this.#differences, threads);
    const hostsChanged = this.#threadHosts.show(rows);
    for (const column of COLUMNS) {
      const counts = lineCounts(threads, column);
      const shown = { column, rows, counts, cells: this.#threadHosts };
      this.#views[column].dispatch({ effects: showThreadRows.of(shown) });
    }
    if (hostsChanged) {
      this.#events.hosts(this.#threadHosts.hosts());
    }
  }

  destroy(): void {
    this.#destroyed = true;
    const hadHosts = this.#threadHosts.hosts().size > 0;
    this.#threadHosts.destroy();
    if (hadHosts) {
      this.#events.hosts(new Map());
    }
    this.#frame.destroy();
    for (const column of COLUMNS) {
      this.#views[column].destroy();
    }
    this.#strip.destroy();
  }
}

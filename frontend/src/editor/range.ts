import type { Difference } from "../ipc";
import type { CompareHosts } from "./compare";
import { showDifferences } from "./internal/compareFields";
import { keyboardColumn, revealDifference } from "./internal/compareFocus";
import { CompareFrame } from "./internal/compareFrame";
import { columnMarks } from "./internal/compareMarks";
import { CompareStrip } from "./internal/compareStrip";
import { COLUMNS, createReadOnlyColumnViews, type ColumnViews } from "./internal/compareViews";
import { languageOf, loadLanguage } from "./internal/language";
import type { Direction } from "./internal/navigation";
import { preferenceEffects, type PaneSettings, type Preferences } from "./internal/pane";

export type RangeTexts = {
  readonly path: string; // the file's path in the range, the old path when deleted: picks the language
  readonly left: string;
  readonly right: string;
  readonly differences: readonly Difference[];
};

export type RangeOptions = { readonly preferences: Preferences };

export class RangeController {
  readonly #views: ColumnViews;
  readonly #strip: CompareStrip;
  readonly #frame: CompareFrame;
  #settings: PaneSettings;
  #destroyed = false;

  constructor(texts: RangeTexts, hosts: CompareHosts, options: RangeOptions) {
    this.#settings = { preferences: options.preferences, platform: navigator.platform };
    this.#views = createReadOnlyColumnViews(texts, hosts, {
      settings: this.#settings,
      updated: (_column, update) => {
        this.#frame.changed(update);
      },
      extensions: [],
    });
    this.#strip = new CompareStrip(hosts.strip);
    this.#frame = new CompareFrame({ views: this.#views, strip: this.#strip });
    for (const column of COLUMNS) {
      const view = this.#views[column];
      const marks = columnMarks(view.state.doc, texts.differences, column);
      view.dispatch({ effects: showDifferences.of(marks) });
    }
    const description = languageOf(texts.path);
    if (description !== null) {
      const { left, right } = this.#views;
      void loadLanguage(description, texts.path, [left, right], () => this.#destroyed);
    }
    this.#frame.request();
  }

  setPreferences(preferences: Preferences): void {
    this.#settings = { ...this.#settings, preferences };
    const effects = preferenceEffects("center", this.#settings);
    for (const column of COLUMNS) {
      this.#views[column].dispatch({ effects });
    }
  }

  moveToChange(direction: Direction): void {
    revealDifference(this.#views[keyboardColumn(this.#views) ?? "left"], direction);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#frame.destroy();
    for (const column of COLUMNS) {
      this.#views[column].destroy();
    }
    this.#strip.destroy();
  }
}

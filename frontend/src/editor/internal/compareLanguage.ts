import type { EditorState } from "@codemirror/state";

import type { Column, TabLanguage } from "../../ipc";
import { isFormatLanguage, type FormatLanguage } from "./compareFormat";
import { detectLanguage } from "./detectLanguage";
import { languageNamed, loadLanguage, type LanguageView } from "./language";
import { languageCompartment } from "./pane";

type LanguageColumn = LanguageView & { readonly state: EditorState };
type Finding = { readonly name: string | null };

const LOG_PATH = "compare";

export class CompareLanguage {
  readonly #columns: Readonly<Record<Column, LanguageColumn>>;
  readonly #detected: (name: string | null) => void;
  #language: TabLanguage = { kind: "auto" };
  #finding: Finding | null = null;
  #shown: string | null = null;
  #destroyed = false;

  constructor(
    language: TabLanguage,
    columns: Readonly<Record<Column, LanguageColumn>>,
    detected: (name: string | null) => void,
  ) {
    this.#columns = columns;
    this.#detected = detected;
    this.set(language);
  }

  set(language: TabLanguage): void {
    this.#language = language;
    if (language.kind === "auto") {
      this.#detect();
    }
    this.#show();
  }

  settled(): void {
    if (this.#language.kind === "auto") {
      this.#detect();
      this.#show();
    }
  }

  formatLanguage(): FormatLanguage | null {
    const name = this.#current();
    return name !== null && isFormatLanguage(name) ? name : null;
  }

  destroy(): void {
    this.#destroyed = true;
  }

  #current(): string | null {
    return this.#language.kind === "auto" ? (this.#finding?.name ?? null) : this.#language.name;
  }

  #detect(): void {
    const { left, right } = this.#columns;
    const name = detectLanguage(left.state.sliceDoc(), right.state.sliceDoc());
    if (this.#finding === null || this.#finding.name !== name) {
      this.#finding = { name };
      this.#detected(name);
    }
  }

  #show(): void {
    const name = this.#current();
    if (name === this.#shown) {
      return;
    }
    this.#shown = name;
    const columns = [this.#columns.left, this.#columns.right];
    const description = name === null ? null : languageNamed(name);
    if (description === null || description.support !== undefined) {
      const effects = languageCompartment.reconfigure(description?.support?.language ?? []);
      for (const column of columns) {
        column.dispatch({ effects });
      }
      return;
    }
    void loadLanguage(
      description,
      LOG_PATH,
      columns,
      () => this.#destroyed || this.#shown !== name,
    );
  }
}

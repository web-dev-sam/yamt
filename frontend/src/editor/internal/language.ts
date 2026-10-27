import { LanguageDescription, type LanguageSupport } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import type { TransactionSpec } from "@codemirror/state";

import { log } from "../../ipc";
import { languageCompartment } from "./pane";

export type LanguageView = { dispatch(spec: TransactionSpec): void };

const LANGUAGE_NAMES: readonly string[] = languages
  .map((description) => description.name)
  .sort((a, b) => a.localeCompare(b));

export function languageOf(path: string): LanguageDescription | null {
  const basename = path.slice(path.lastIndexOf("/") + 1);
  return LanguageDescription.matchFilename(languages, basename);
}

export function languageNamed(name: string): LanguageDescription | null {
  return LanguageDescription.matchLanguageName(languages, name, false);
}

export function languageNames(): readonly string[] {
  return LANGUAGE_NAMES;
}

export async function loadedSupport(
  description: LanguageDescription,
  fields: Readonly<Record<string, string>>,
): Promise<LanguageSupport | null> {
  try {
    return await description.load();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.warn("language.load_failed", { ...fields, language: description.name, reason });
    return null;
  }
}

export async function loadLanguage(
  description: LanguageDescription,
  path: string,
  views: readonly LanguageView[],
  stale: () => boolean,
): Promise<void> {
  const support = await loadedSupport(description, { path });
  if (support === null || stale()) {
    return;
  }
  const effects = languageCompartment.reconfigure(support.language);
  for (const view of views) {
    view.dispatch({ effects });
  }
}

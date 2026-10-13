import { LanguageDescription, type LanguageSupport } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

import { log } from "../../ipc";
import type { PaneViews } from "./geometry";
import { languageCompartment } from "./pane";

export function languageOf(path: string): LanguageDescription | null {
  const basename = path.slice(path.lastIndexOf("/") + 1);
  return LanguageDescription.matchFilename(languages, basename);
}

export async function loadLanguage(
  description: LanguageDescription,
  path: string,
  views: PaneViews,
  destroyed: () => boolean,
): Promise<void> {
  let support: LanguageSupport;
  try {
    support = await description.load();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.warn("language.load_failed", { path, language: description.name, reason });
    return;
  }
  if (destroyed()) {
    return;
  }
  const effects = languageCompartment.reconfigure(support.language);
  for (const view of [views.left, views.center, views.right]) {
    view.dispatch({ effects });
  }
}

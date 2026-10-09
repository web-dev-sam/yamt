import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

export function languageOf(path: string): LanguageDescription | null {
  const basename = path.slice(path.lastIndexOf("/") + 1);
  return LanguageDescription.matchFilename(languages, basename);
}

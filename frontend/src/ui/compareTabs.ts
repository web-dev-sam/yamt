import type { TabLanguage } from "../ipc";

/** What Auto found: a language name, null when it found none, undefined before it looked. */
export type Detected = string | null | undefined;

export function languageLabel(language: TabLanguage, detected: Detected): string {
  switch (language.kind) {
    case "auto":
      return detected === undefined ? "Auto" : `Auto · ${detected ?? "Plain text"}`;
    case "picked":
      return language.name;
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

import type { TabLanguage } from "../ipc";

export function languageLabel(language: TabLanguage, detected: string | null): string {
  switch (language.kind) {
    case "auto":
      return `Auto · ${detected ?? "Plain text"}`;
    case "picked":
      return language.name;
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

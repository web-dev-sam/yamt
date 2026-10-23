import type { Theme } from "./domain";

const GROUPS = ["yamt", "WebStorm", "VS Code", "Zed", "Atom"] as const;
const KINDS = ["dark", "light"] as const;

type ThemeGroup = (typeof GROUPS)[number];

type ThemeKind = (typeof KINDS)[number];

type ThemeWords = { readonly group: ThemeGroup; readonly label: string; readonly kind: ThemeKind };

type ThemeRow = {
  readonly group: ThemeGroup;
  readonly themes: readonly { readonly value: Theme; readonly label: string }[];
};

export const THEMES: Readonly<Record<Theme, ThemeWords>> = {
  dark: { group: "yamt", label: "Dark", kind: "dark" },
  light: { group: "yamt", label: "Light", kind: "light" },
  "webstorm-dark": { group: "WebStorm", label: "Islands Dark", kind: "dark" },
  "webstorm-light": { group: "WebStorm", label: "Islands Light", kind: "light" },
  "vscode-dark": { group: "VS Code", label: "Dark 2026", kind: "dark" },
  "vscode-light": { group: "VS Code", label: "Light 2026", kind: "light" },
  "zed-dark": { group: "Zed", label: "One Dark", kind: "dark" },
  "zed-light": { group: "Zed", label: "One Light", kind: "light" },
  "atom-dark": { group: "Atom", label: "One Dark", kind: "dark" },
  "atom-light": { group: "Atom", label: "One Light", kind: "light" },
};

function isTheme(value: string): value is Theme {
  return Object.hasOwn(THEMES, value);
}

export function themeOf(value: string | undefined): Theme {
  return value !== undefined && isTheme(value) ? value : "dark";
}

export function themeKind(theme: Theme): ThemeKind {
  return THEMES[theme].kind;
}

export function themeRows(): readonly ThemeRow[] {
  const names = Object.keys(THEMES).filter(isTheme);
  return GROUPS.map((group) => ({
    group,
    themes: KINDS.flatMap((kind) =>
      names
        .filter((name) => THEMES[name].group === group && THEMES[name].kind === kind)
        .map((value) => ({ value, label: THEMES[value].label })),
    ),
  }));
}

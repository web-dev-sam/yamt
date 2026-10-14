import type { StoredSettings } from "./domain";

export const KEY_ACTIONS = [
  "apply",
  "ignore",
  "next-change",
  "previous-change",
  "left-side",
  "right-side",
  "undo",
  "redo",
  "save",
  "find",
  "find-next",
  "find-previous",
  "close-find",
  "indent",
  "outdent",
  "toggle-file-list",
] as const;

export type KeyAction = (typeof KEY_ACTIONS)[number];

export type KeyName = string & { readonly __brand: "KeyName" };

export type Key = {
  readonly mod: boolean;
  readonly macCtrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly name: KeyName;
};

export type KeyBindings = Readonly<Record<KeyAction, readonly Key[]>>;

export type KeyProblem =
  | { readonly kind: "unreadable"; readonly action: KeyAction; readonly text: string }
  | {
      readonly kind: "twice";
      readonly key: Key;
      readonly actions: readonly [KeyAction, KeyAction];
    };

export type KeysRead = { readonly bindings: KeyBindings; readonly problems: readonly KeyProblem[] };

type Modifier = "mod" | "macCtrl" | "alt" | "shift";

const MODIFIERS: readonly { readonly modifier: Modifier; readonly prefix: string }[] = [
  { modifier: "mod", prefix: "Mod-" },
  { modifier: "macCtrl", prefix: "MacCtrl-" },
  { modifier: "alt", prefix: "Alt-" },
  { modifier: "shift", prefix: "Shift-" },
];

const FUNCTION_KEY_COUNT = 12;

const NAMED_KEYS: Readonly<Record<string, true>> = Object.fromEntries(
  [
    "Enter",
    "Space",
    "Tab",
    "Escape",
    "Backspace",
    "Delete",
    "Insert",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    ...Array.from({ length: FUNCTION_KEY_COUNT }, (_, index) => `F${index + 1}`),
  ].map((name) => [name, true]),
);

const ONE_CHARACTER = /^.$/su;
const WHITESPACE = /^\s$/u;
const LATIN_LETTER = /^[a-z]$/i;
const LETTER_OR_MARK = /^[\p{L}\p{M}]$/u;
const LETTER_CODE = /^Key([A-Z])$/;

export function isLetter(name: string): boolean {
  return ONE_CHARACTER.test(name) && name.toLowerCase() !== name.toUpperCase();
}

function isKeyName(text: string): text is KeyName {
  if (Object.hasOwn(NAMED_KEYS, text)) {
    return true;
  }
  return ONE_CHARACTER.test(text) && !WHITESPACE.test(text) && text === text.toLowerCase();
}

// The platform test CodeMirror uses for `Mod` (@codemirror/view browser.mac).
export function isMac(platform: string): boolean {
  return /Mac/.test(platform);
}

export function parseKey(text: string): Key | null {
  let rest = text;
  const held: Record<Modifier, boolean> = { mod: false, macCtrl: false, alt: false, shift: false };
  for (const { modifier, prefix } of MODIFIERS) {
    if (rest.startsWith(prefix) && rest.length > prefix.length) {
      held[modifier] = true;
      rest = rest.slice(prefix.length);
    }
  }
  const shiftedSymbol = held.shift && !Object.hasOwn(NAMED_KEYS, rest) && !isLetter(rest);
  return isKeyName(rest) && !shiftedSymbol ? { ...held, name: rest } : null;
}

export function keyText(key: Key): string {
  const prefixes = MODIFIERS.filter(({ modifier }) => key[modifier]).map(({ prefix }) => prefix);
  return `${prefixes.join("")}${key.name}`;
}

const LINUX_NAMES: Readonly<Record<string, string>> = {
  PageUp: "Page Up",
  PageDown: "Page Down",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

// IntelliJ's MacKeymapUtil symbols (intellij.platform.ide.jar, com/intellij/openapi/keymap).
const MAC_NAMES: Readonly<Record<string, string>> = {
  Enter: "⏎",
  Tab: "⇥",
  Escape: "⎋",
  Backspace: "⌫",
  Delete: "⌦",
  Home: "↖",
  End: "↘",
  PageUp: "⇞",
  PageDown: "⇟",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

function nameLabel(name: KeyName, names: Readonly<Record<string, string>>): string {
  if (Object.hasOwn(NAMED_KEYS, name)) {
    return names[name] ?? name;
  }
  return name.toUpperCase();
}

function macLabel(key: Key): string {
  const symbols = [
    key.macCtrl ? "⌃" : "",
    key.alt ? "⌥" : "",
    key.shift ? "⇧" : "",
    key.mod ? "⌘" : "",
  ];
  return `${symbols.join("")}${nameLabel(key.name, MAC_NAMES)}`;
}

export function keyLabel(key: Key, platform: string): string {
  if (isMac(platform)) {
    return macLabel(key);
  }
  if (key.macCtrl) {
    return `${macLabel(key)} (macOS)`;
  }
  const held = [key.mod ? "Ctrl" : "", key.alt ? "Alt" : "", key.shift ? "Shift" : ""];
  return [...held.filter((word) => word !== ""), nameLabel(key.name, LINUX_NAMES)].join("+");
}

export function sameKey(a: Key, b: Key): boolean {
  return a.name === b.name && MODIFIERS.every(({ modifier }) => a[modifier] === b[modifier]);
}

function defaultKeys(...texts: string[]): readonly Key[] {
  return texts.map((text) => {
    const key = parseKey(text);
    if (key === null) {
      throw new Error(`default key ${text} does not parse`);
    }
    return key;
  });
}

export const DEFAULT_KEYS: KeyBindings = {
  apply: defaultKeys("Enter", "Space"),
  ignore: defaultKeys("Backspace", "Delete", "x"),
  "next-change": defaultKeys("ArrowDown"),
  "previous-change": defaultKeys("ArrowUp"),
  "left-side": defaultKeys("ArrowLeft"),
  "right-side": defaultKeys("ArrowRight"),
  undo: defaultKeys("Mod-z"),
  redo: defaultKeys("Mod-Shift-z", "Mod-y"),
  save: defaultKeys("Mod-s"),
  find: defaultKeys("Mod-f"),
  "find-next": defaultKeys("F3"),
  "find-previous": defaultKeys("Shift-F3"),
  "close-find": defaultKeys("Escape"),
  indent: defaultKeys("Tab"),
  outdent: defaultKeys("Shift-Tab"),
  "toggle-file-list": defaultKeys("Mod-b"),
};

type Pressed = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

// Like CodeMirror's runHandlers (@codemirror/view keymap.ts: with Ctrl, Cmd or Alt held, a typed
// character other than the Latin layout's falls back to the physical key; never for macOS Alt alone,
// which types characters), but only for letters, so Dvorak's ';' on KeyZ stays ';'.
function characterOf({ key, code }: Pressed, physical: boolean): string {
  if (physical && !LATIN_LETTER.test(key) && LETTER_OR_MARK.test(key)) {
    const letter = LETTER_CODE.exec(code)?.[1];
    if (letter !== undefined) {
      return letter.toLowerCase();
    }
  }
  return key.toLowerCase();
}

export function keyOfEvent(event: Pressed, platform: string): Key | null {
  const mac = isMac(platform);
  if (event.metaKey && !mac) {
    return null;
  }
  const mod = mac ? event.metaKey : event.ctrlKey;
  const macCtrl = mac && event.ctrlKey;
  const alt = event.altKey;
  const named = event.key === " " ? "Space" : event.key;
  if (Object.hasOwn(NAMED_KEYS, named)) {
    return isKeyName(named) ? { mod, macCtrl, alt, shift: event.shiftKey, name: named } : null;
  }
  if (!ONE_CHARACTER.test(event.key)) {
    return null;
  }
  const character = characterOf(event, mod || macCtrl || (alt && !mac));
  const shift = event.shiftKey && isLetter(character);
  return isKeyName(character) ? { mod, macCtrl, alt, shift, name: character } : null;
}

export function pressesKey(event: Pressed, keys: readonly Key[], platform: string): boolean {
  const pressed = keyOfEvent(event, platform);
  return pressed !== null && keys.some((key) => sameKey(key, pressed));
}

function storedKeys(
  action: KeyAction,
  stored: StoredSettings["keys"],
): { readonly keys: readonly Key[]; readonly problem: KeyProblem | null } {
  const texts = stored[action];
  if (texts === undefined) {
    return { keys: DEFAULT_KEYS[action], problem: null };
  }
  const keys: Key[] = [];
  for (const text of texts) {
    const key = parseKey(text);
    if (key === null) {
      return { keys: DEFAULT_KEYS[action], problem: { kind: "unreadable", action, text } };
    }
    if (!keys.some((known) => sameKey(known, key))) {
      keys.push(key);
    }
  }
  return { keys, problem: null };
}

export function bindingsOf(stored: StoredSettings["keys"]): KeysRead {
  const problems: KeyProblem[] = [];
  const owners: { readonly key: Key; readonly action: KeyAction }[] = [];
  const read: Record<KeyAction, readonly Key[]> = { ...DEFAULT_KEYS };
  for (const action of KEY_ACTIONS) {
    const { keys, problem } = storedKeys(action, stored);
    if (problem !== null) {
      problems.push(problem);
    }
    read[action] = keys.filter((key) => {
      const owner = owners.find((claimed) => sameKey(claimed.key, key));
      if (owner === undefined) {
        owners.push({ key, action });
        return true;
      }
      problems.push({ kind: "twice", key, actions: [owner.action, action] });
      return false;
    });
  }
  return { bindings: read, problems };
}

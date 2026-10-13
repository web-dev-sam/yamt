const MODIFIERS = ["Ctrl", "Shift", "Alt", "Meta"] as const;
type Modifier = (typeof MODIFIERS)[number];

const NAMED_KEYS = [
  "Enter",
  "Escape",
  "Tab",
  "Backspace",
  "Delete",
  "Insert",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
] as const;
type NamedKey = (typeof NAMED_KEYS)[number];

type Key =
  | { readonly kind: "named"; readonly name: NamedKey }
  | { readonly kind: "char"; readonly char: string };

export type Chord = { readonly modifiers: readonly Modifier[]; readonly key: Key };

export type KeyAction = { readonly type: "keyDown" | "keyUp"; readonly value: string };

const MODIFIER_ALIASES: Readonly<Record<string, Modifier>> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  meta: "Meta",
  cmd: "Meta",
  super: "Meta",
};

const KEY_ALIASES: Readonly<Record<string, NamedKey>> = {
  esc: "Escape",
  return: "Enter",
  del: "Delete",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

// WebDriver key codes: https://www.w3.org/TR/webdriver2/#keyboard-actions (table "normalised key value").
const WEBDRIVER_MODIFIERS: Readonly<Record<Modifier, string>> = {
  Ctrl: "\uE009",
  Shift: "\uE008",
  Alt: "\uE00A",
  Meta: "\uE03D",
};

const WEBDRIVER_KEYS: Readonly<Record<NamedKey, string>> = {
  Enter: "\uE007",
  Escape: "\uE00C",
  Tab: "\uE004",
  Backspace: "\uE003",
  Delete: "\uE017",
  Insert: "\uE016",
  Space: "\uE00D",
  ArrowUp: "\uE013",
  ArrowDown: "\uE015",
  ArrowLeft: "\uE012",
  ArrowRight: "\uE014",
  Home: "\uE011",
  End: "\uE010",
  PageUp: "\uE00E",
  PageDown: "\uE00F",
  F1: "\uE031",
  F2: "\uE032",
  F3: "\uE033",
  F4: "\uE034",
  F5: "\uE035",
  F6: "\uE036",
  F7: "\uE037",
  F8: "\uE038",
  F9: "\uE039",
  F10: "\uE03A",
  F11: "\uE03B",
  F12: "\uE03C",
};

const XDOTOOL_MODIFIERS: Readonly<Record<Modifier, string>> = {
  Ctrl: "ctrl",
  Shift: "shift",
  Alt: "alt",
  Meta: "super",
};

// X keysym names: /usr/include/X11/keysymdef.h (XK_<name>).
const XDOTOOL_KEYS: Readonly<Record<NamedKey, string>> = {
  Enter: "Return",
  Escape: "Escape",
  Tab: "Tab",
  Backspace: "BackSpace",
  Delete: "Delete",
  Insert: "Insert",
  Space: "space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Home: "Home",
  End: "End",
  PageUp: "Prior",
  PageDown: "Next",
  F1: "F1",
  F2: "F2",
  F3: "F3",
  F4: "F4",
  F5: "F5",
  F6: "F6",
  F7: "F7",
  F8: "F8",
  F9: "F9",
  F10: "F10",
  F11: "F11",
  F12: "F12",
};

const PUNCTUATION_KEYSYMS: Readonly<Record<string, string>> = {
  "`": "grave",
  "~": "asciitilde",
  "!": "exclam",
  "@": "at",
  "#": "numbersign",
  $: "dollar",
  "%": "percent",
  "^": "asciicircum",
  "&": "ampersand",
  "*": "asterisk",
  "(": "parenleft",
  ")": "parenright",
  "-": "minus",
  _: "underscore",
  "=": "equal",
  "+": "plus",
  "[": "bracketleft",
  "]": "bracketright",
  "{": "braceleft",
  "}": "braceright",
  "\\": "backslash",
  "|": "bar",
  ";": "semicolon",
  ":": "colon",
  "'": "apostrophe",
  '"': "quotedbl",
  ",": "comma",
  ".": "period",
  "<": "less",
  ">": "greater",
  "/": "slash",
  "?": "question",
};

const ALPHANUMERIC = /^[a-z0-9]$/;

function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter().segment(text), ({ segment }) => segment);
}

function parseKey(text: string): Key {
  const lower = text.toLowerCase();
  const named = NAMED_KEYS.find((key) => key.toLowerCase() === lower) ?? KEY_ALIASES[lower];
  if (named !== undefined) {
    return { kind: "named", name: named };
  }
  if (text === " ") {
    return { kind: "named", name: "Space" };
  }
  if (graphemes(text).length === 1) {
    return { kind: "char", char: lower };
  }
  throw new Error(`unknown key "${text}" (named keys: ${NAMED_KEYS.join(", ")})`);
}

export function parseChord(text: string): Chord {
  if (text === "+") {
    return { modifiers: [], key: { kind: "char", char: "+" } };
  }
  const body = text.endsWith("++") ? text.slice(0, -1) : text;
  const parts = body.split("+");
  const keyText = body === text ? (parts.at(-1) ?? "") : "+";
  const modifiers = parts.slice(0, -1).map((part) => {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier === undefined) {
      throw new Error(`unknown modifier "${part}" in "${text}" (${MODIFIERS.join(", ")})`);
    }
    return modifier;
  });
  if (new Set(modifiers).size !== modifiers.length) {
    throw new Error(`repeated modifier in "${text}"`);
  }
  if (keyText.length === 0) {
    throw new Error(`no key in "${text}"`);
  }
  return { modifiers, key: parseKey(keyText) };
}

export function chordActions(chord: Chord): KeyAction[] {
  const modifiers = chord.modifiers.map((modifier) => WEBDRIVER_MODIFIERS[modifier]);
  const key = chord.key.kind === "named" ? WEBDRIVER_KEYS[chord.key.name] : chord.key.char;
  return [
    ...modifiers.map((value) => ({ type: "keyDown" as const, value })),
    { type: "keyDown", value: key },
    { type: "keyUp", value: key },
    ...modifiers.toReversed().map((value) => ({ type: "keyUp" as const, value })),
  ];
}

export function textActions(text: string): KeyAction[] {
  return graphemes(text).flatMap((char) => {
    const value = char === "\n" ? WEBDRIVER_KEYS.Enter : char;
    return [
      { type: "keyDown" as const, value },
      { type: "keyUp" as const, value },
    ];
  });
}

function keysym(key: Key): string {
  if (key.kind === "named") {
    return XDOTOOL_KEYS[key.name];
  }
  if (ALPHANUMERIC.test(key.char)) {
    return key.char;
  }
  const name = PUNCTUATION_KEYSYMS[key.char];
  if (name === undefined) {
    throw new Error(`no X keysym for "${key.char}"; use type --x11 for text`);
  }
  return name;
}

export function xdotoolChord(chord: Chord): string {
  return [
    ...chord.modifiers.map((modifier) => XDOTOOL_MODIFIERS[modifier]),
    keysym(chord.key),
  ].join("+");
}

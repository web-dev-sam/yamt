import { isLetter, isMac, type Key } from "../../ipc";

// CodeMirror matches Shift with a character only through the character itself: Shift+x arrives as
// "X" and is looked up without "Shift-" (@codemirror/view keymap.ts runHandlers, `modifiers(name,
// event, !isChar)`); with Ctrl, Cmd or Alt held it falls back to "Shift-…-x".
export function cmKey(key: Key, platform: string): string | null {
  if (key.macCtrl && !isMac(platform)) {
    return null;
  }
  const alone = !key.mod && !key.macCtrl && !key.alt;
  if (key.shift && alone && isLetter(key.name)) {
    return key.name.toUpperCase();
  }
  const prefixes = [
    key.mod ? "Mod-" : "",
    key.macCtrl ? "Ctrl-" : "",
    key.alt ? "Alt-" : "",
    key.shift ? "Shift-" : "",
  ];
  return `${prefixes.join("")}${key.name}`;
}

export function cmKeys(keys: readonly Key[], platform: string): string[] {
  return keys.flatMap((key) => cmKey(key, platform) ?? []);
}

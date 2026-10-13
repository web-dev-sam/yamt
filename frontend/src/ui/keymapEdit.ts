import {
  DEFAULT_KEYS,
  KEY_ACTIONS,
  keyText,
  sameKey,
  type Key,
  type KeyAction,
  type KeyBindings,
  type KeysChange,
} from "../ipc";

export type KeyEdit =
  | { readonly kind: "add"; readonly action: KeyAction; readonly key: Key }
  | { readonly kind: "change"; readonly action: KeyAction; readonly from: Key; readonly to: Key }
  | { readonly kind: "remove"; readonly action: KeyAction; readonly key: Key }
  | { readonly kind: "removeAll"; readonly action: KeyAction }
  | { readonly kind: "reset"; readonly action: KeyAction };

export type Clash = { readonly key: Key; readonly action: KeyAction; readonly owner: KeyAction };

export type KeyEditPlan =
  | { readonly kind: "nothing" }
  | { readonly kind: "send"; readonly changes: readonly KeysChange[] }
  | { readonly kind: "ask"; readonly clash: Clash; readonly changes: readonly KeysChange[] };

const NOTHING: KeyEditPlan = { kind: "nothing" };

function holds(keys: readonly Key[], key: Key): boolean {
  return keys.some((held) => sameKey(held, key));
}

export function isDefault(action: KeyAction, keys: readonly Key[]): boolean {
  const defaults = DEFAULT_KEYS[action];
  return keys.length === defaults.length && defaults.every((key) => holds(keys, key));
}

function keysChange(action: KeyAction, keys: readonly Key[]): KeysChange {
  return { action, keys: isDefault(action, keys) ? null : keys.map(keyText) };
}

function placed(
  bindings: KeyBindings,
  clash: Omit<Clash, "owner">,
  keys: readonly Key[],
): KeyEditPlan {
  const { action, key } = clash;
  const owner = KEY_ACTIONS.find((other) => other !== action && holds(bindings[other], key));
  const change = keysChange(action, keys);
  if (owner === undefined) {
    return { kind: "send", changes: [change] };
  }
  const left = bindings[owner].filter((held) => !sameKey(held, key));
  return { kind: "ask", clash: { ...clash, owner }, changes: [change, keysChange(owner, left)] };
}

function changed(keys: readonly Key[], from: Key, to: Key): readonly Key[] {
  return holds(keys, to)
    ? keys.filter((key) => !sameKey(key, from))
    : keys.map((key) => (sameKey(key, from) ? to : key));
}

export function planKeyEdit(bindings: KeyBindings, edit: KeyEdit): KeyEditPlan {
  const { action } = edit;
  const keys = bindings[action];
  switch (edit.kind) {
    case "add":
      return holds(keys, edit.key)
        ? NOTHING
        : placed(bindings, { action, key: edit.key }, [...keys, edit.key]);
    case "change":
      return !holds(keys, edit.from) || sameKey(edit.from, edit.to)
        ? NOTHING
        : placed(bindings, { action, key: edit.to }, changed(keys, edit.from, edit.to));
    case "remove":
      return holds(keys, edit.key)
        ? {
            kind: "send",
            changes: [
              keysChange(
                action,
                keys.filter((key) => !sameKey(key, edit.key)),
              ),
            ],
          }
        : NOTHING;
    case "removeAll":
      return keys.length === 0 ? NOTHING : { kind: "send", changes: [keysChange(action, [])] };
    case "reset":
      return { kind: "send", changes: [{ action, keys: null }] };
    default: {
      const _exhaustive: never = edit;
      return _exhaustive;
    }
  }
}

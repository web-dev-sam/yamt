import type { StorageLike } from "@vueuse/core";
import { computed, type Ref } from "vue";

import type { AbortState } from "./aborting";
import { storedValue } from "./windowStorage";

export const TOOLBAR_BUTTONS = [
  "abortMerge",
  "previous",
  "next",
  "collapse",
  "applyLeft",
  "applyRight",
  "undo",
  "redo",
] as const;

export type ToolbarButtonId = (typeof TOOLBAR_BUTTONS)[number];

export type HiddenButtons = {
  readonly hidden: Readonly<Ref<ReadonlySet<ToolbarButtonId>>>;
  readonly toggle: (id: ToolbarButtonId) => void;
};

type Decisions = Readonly<Partial<Record<ToolbarButtonId, boolean>>>;

const STORAGE_KEY = "yamt.toolbar.hidden";

const OLD_FORMAT_IDS = [
  "previous",
  "next",
  "collapse",
  "applyLeft",
  "applyRight",
  "undo",
  "redo",
] as const satisfies readonly ToolbarButtonId[];

// Abort merge, Undo and Redo start hidden until the user shows them (plan §2 #58, #74); the
// keys of Undo and Redo still work.
const HIDDEN_AT_FIRST: Readonly<Record<ToolbarButtonId, boolean>> = {
  abortMerge: true,
  previous: false,
  next: false,
  collapse: false,
  applyLeft: false,
  applyRight: false,
  undo: true,
  redo: true,
};

export function listedButtons(abort: AbortState): readonly ToolbarButtonId[] {
  return TOOLBAR_BUTTONS.filter((id) => id !== "abortMerge" || abort !== "noMerge");
}

export function shownButtons(
  abort: AbortState,
  hidden: ReadonlySet<ToolbarButtonId>,
): readonly ToolbarButtonId[] {
  return listedButtons(abort).filter((id) => !hidden.has(id));
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readHiddenList(names: readonly unknown[]): Decisions {
  if (!names.every((name) => typeof name === "string")) {
    return {};
  }
  const decided: Partial<Record<ToolbarButtonId, boolean>> = {};
  for (const id of OLD_FORMAT_IDS) {
    decided[id] = names.includes(id);
  }
  return decided;
}

function readDecided(stored: object): Decisions {
  const decided: Partial<Record<ToolbarButtonId, boolean>> = {};
  for (const id of TOOLBAR_BUTTONS) {
    const hidden: unknown = Reflect.get(stored, id);
    if (typeof hidden === "boolean") {
      decided[id] = hidden;
    }
  }
  return decided;
}

function readDecisions(raw: string): Decisions {
  const stored = parseJson(raw);
  if (Array.isArray(stored)) {
    return readHiddenList(stored);
  }
  return typeof stored === "object" && stored !== null ? readDecided(stored) : {};
}

export function createHiddenButtons(storage?: StorageLike): HiddenButtons {
  const decided = storedValue<Decisions>(
    STORAGE_KEY,
    {},
    { read: readDecisions, write: (value) => JSON.stringify(value) },
    "toolbar.storage_failed",
    storage,
  );
  const hidden = computed(
    (): ReadonlySet<ToolbarButtonId> =>
      new Set(TOOLBAR_BUTTONS.filter((id) => decided.value[id] ?? HIDDEN_AT_FIRST[id])),
  );
  return {
    hidden,
    toggle: (id) => {
      decided.value = { ...decided.value, [id]: !hidden.value.has(id) };
    },
  };
}

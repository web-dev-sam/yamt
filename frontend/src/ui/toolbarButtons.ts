import type { StorageLike } from "@vueuse/core";
import { computed, type Ref } from "vue";

import type { OperationView } from "../ipc";
import { abortLabel, continueLabel } from "./operationText";
import { parseStored, storedValue } from "./windowStorage";

export const TOOLBAR_BUTTONS = [
  "continue",
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

export type ListedButton = { readonly id: ToolbarButtonId; readonly label: string };

type OperationButtonId = "continue" | "abortMerge";

export type IconButtonId = Exclude<ToolbarButtonId, "continue">;

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

const LABELS: Readonly<Record<Exclude<ToolbarButtonId, OperationButtonId>, string>> = {
  previous: "Previous change",
  next: "Next change",
  collapse: "Collapse unchanged fragments",
  applyLeft: "Apply non-conflicting changes from the left",
  applyRight: "Apply non-conflicting changes from the right",
  undo: "Undo",
  redo: "Redo",
};

// Abort, Undo and Redo start hidden until the user shows them (plan §2 #58, #74, #88); the
// keys of Undo and Redo still work.
const HIDDEN_AT_FIRST: Readonly<Record<ToolbarButtonId, boolean>> = {
  continue: false,
  abortMerge: true,
  previous: false,
  next: false,
  collapse: false,
  applyLeft: false,
  applyRight: false,
  undo: true,
  redo: true,
};

export function listedButtons(operation: OperationView | null): readonly ListedButton[] {
  return TOOLBAR_BUTTONS.flatMap((id): ListedButton[] => {
    if (id !== "continue" && id !== "abortMerge") {
      return [{ id, label: LABELS[id] }];
    }
    if (operation === null) {
      return [];
    }
    return [{ id, label: id === "continue" ? continueLabel(operation) : abortLabel(operation) }];
  });
}

export function shownButtons(
  operation: OperationView | null,
  hidden: ReadonlySet<ToolbarButtonId>,
): readonly ListedButton[] {
  return listedButtons(operation).filter((button) => !hidden.has(button.id));
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
  const stored = parseStored(raw);
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

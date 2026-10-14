import type { StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import { storedValue } from "./windowStorage";

export const TOOLBAR_BUTTONS = [
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

const STORAGE_KEY = "yamt.toolbar.hidden";

// Undo and Redo start hidden until the user shows them (plan §2 #58); their keys still work.
const HIDDEN_AT_FIRST: ReadonlySet<ToolbarButtonId> = new Set(["undo", "redo"]);

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readHidden(raw: string): ReadonlySet<ToolbarButtonId> {
  const names = parseJson(raw);
  if (!Array.isArray(names) || !names.every((name) => typeof name === "string")) {
    return HIDDEN_AT_FIRST;
  }
  return new Set(TOOLBAR_BUTTONS.filter((id) => names.includes(id)));
}

function writeHidden(hidden: ReadonlySet<ToolbarButtonId>): string {
  return JSON.stringify(TOOLBAR_BUTTONS.filter((id) => hidden.has(id)));
}

export function createHiddenButtons(storage?: StorageLike): HiddenButtons {
  const hidden = storedValue<ReadonlySet<ToolbarButtonId>>(
    STORAGE_KEY,
    HIDDEN_AT_FIRST,
    { read: readHidden, write: writeHidden },
    "toolbar.storage_failed",
    storage,
  );
  return {
    hidden,
    toggle: (id) => {
      const next = new Set(hidden.value);
      if (!next.delete(id)) {
        next.add(id);
      }
      hidden.value = next;
    },
  };
}

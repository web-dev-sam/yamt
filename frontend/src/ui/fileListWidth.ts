import type { StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import { storedValue } from "./windowStorage";

const STORAGE_KEY = "yamt.files.width";
const MIN_WIDTH_PX = 160;
const MAX_WINDOW_SHARE = 0.5;
const PERCENT = 100;

export const FILE_LIST_BOUNDS = {
  minWidth: `${MIN_WIDTH_PX}px`,
  maxWidth: `${MAX_WINDOW_SHARE * PERCENT}vw`,
} as const;

export function createFileListWidth(storage?: StorageLike): {
  readonly width: Readonly<Ref<number | null>>;
  setWidth(px: number, windowWidth: number): void;
  resetWidth(): void;
} {
  const width = storedValue<number | null>(
    STORAGE_KEY,
    null,
    {
      read: (raw) => {
        const px = Number(raw);
        return Number.isFinite(px) && px >= MIN_WIDTH_PX ? px : null;
      },
      write: (px) => String(px),
    },
    "files.width_storage_failed",
    storage,
  );
  return {
    width,
    setWidth: (px, windowWidth) => {
      width.value = Math.max(MIN_WIDTH_PX, Math.min(px, windowWidth * MAX_WINDOW_SHARE));
    },
    resetWidth: () => {
      width.value = null;
    },
  };
}

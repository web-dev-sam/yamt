import type { StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import { storedValue } from "./windowStorage";

const STORAGE_KEY = "yamt.files.width";
const MIN_WIDTH_PX = 160;
const HALF = 0.5;

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
      width.value = Math.max(MIN_WIDTH_PX, Math.min(px, windowWidth * HALF));
    },
    resetWidth: () => {
      width.value = null;
    },
  };
}

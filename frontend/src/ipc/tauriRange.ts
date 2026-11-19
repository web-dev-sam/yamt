import { commands } from "./bindings";
import { toRangeFile, toRangeStart, toSearchTexts } from "./rangeDomain";
import type { RangeSource } from "./RangeSource";
import { converted, createTauriSettings, toResult } from "./tauri";
import { createTauriMergeRequests } from "./tauriMergeRequests";
import { createTauriReview } from "./tauriReview";
import { createTauriReviewed } from "./tauriReviewed";

export function createTauriRangeSource(): RangeSource {
  return {
    async openRange() {
      return { ok: true, value: toRangeStart(await commands.openRange()) };
    },
    async loadRangeFile(file) {
      return converted(toResult(await commands.loadRangeFile(file)), toRangeFile);
    },
    async searchTexts(from) {
      return converted(toResult(await commands.searchRangeTexts(from)), toSearchTexts);
    },
    ...createTauriReview(),
    ...createTauriReviewed(),
    ...createTauriSettings(),
    ...createTauriMergeRequests(),
  };
}

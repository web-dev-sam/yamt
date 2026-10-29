import { commands } from "./bindings";
import { toRangeFile, toRangeStart, toSearchTexts } from "./rangeDomain";
import type { RangeSource } from "./RangeSource";
import { converted, createTauriSettings, toResult } from "./tauri";
import { createTauriReview } from "./tauriReview";

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
    ...createTauriSettings(),
  };
}

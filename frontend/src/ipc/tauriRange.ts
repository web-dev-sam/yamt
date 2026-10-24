import { commands } from "./bindings";
import { toRangeFile, toRangeStart } from "./rangeDomain";
import type { RangeSource } from "./RangeSource";
import { createTauriSettings, toResult } from "./tauri";

export function createTauriRangeSource(): RangeSource {
  return {
    async openRange() {
      return { ok: true, value: toRangeStart(await commands.openRange()) };
    },
    async loadRangeFile(file) {
      const result = toResult(await commands.loadRangeFile(file));
      return result.ok ? { ok: true, value: toRangeFile(result.value) } : result;
    },
    ...createTauriSettings(),
  };
}

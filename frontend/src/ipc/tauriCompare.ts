import { commands } from "./bindings";
import { toComparison, toCompareStart, toTabList, toTabTexts } from "./compareDomain";
import type { CompareSource } from "./CompareSource";
import { createTauriSettings, toResult } from "./tauri";

export function createTauriCompareSource(): CompareSource {
  return {
    async openCompare() {
      const result = toResult(await commands.openCompare());
      return result.ok ? { ok: true, value: toCompareStart(result.value) } : result;
    },
    async loadTab(tab) {
      const result = toResult(await commands.loadTab(tab));
      return result.ok ? { ok: true, value: toTabTexts(result.value) } : result;
    },
    async setColumn({ tab, column, text, version }) {
      const result = toResult(await commands.setColumn(tab, column, text, version));
      return result.ok ? { ok: true, value: toComparison(result.value) } : result;
    },
    async addTab() {
      const result = toResult(await commands.addTab());
      return result.ok ? { ok: true, value: toTabList(result.value) } : result;
    },
    async closeTab(tab) {
      const result = toResult(await commands.closeTab(tab));
      return result.ok ? { ok: true, value: toTabList(result.value) } : result;
    },
    async renameTab(tab, name) {
      const result = toResult(await commands.renameTab(tab, name));
      return result.ok ? { ok: true, value: toTabList(result.value) } : result;
    },
    async setTabLanguage(tab, language) {
      const result = toResult(await commands.setTabLanguage(tab, language));
      return result.ok ? { ok: true, value: toTabList(result.value) } : result;
    },
    async showTab(tab) {
      const result = toResult(await commands.showTab(tab));
      return result.ok ? { ok: true, value: toTabList(result.value) } : result;
    },
    ...createTauriSettings(),
  };
}

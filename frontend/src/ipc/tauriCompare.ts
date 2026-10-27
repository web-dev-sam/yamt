import { commands } from "./bindings";
import { toComparison, toCompareStart, toTabList, toTabTexts } from "./compareDomain";
import type { CompareSource } from "./CompareSource";
import { converted, createTauriSettings, toResult } from "./tauri";

export function createTauriCompareSource(): CompareSource {
  return {
    async openCompare() {
      return converted(toResult(await commands.openCompare()), toCompareStart);
    },
    async loadTab(tab) {
      return converted(toResult(await commands.loadTab(tab)), toTabTexts);
    },
    async setColumn({ tab, column, text, version }) {
      return converted(
        toResult(await commands.setColumn(tab, column, text, version)),
        toComparison,
      );
    },
    async addTab() {
      return converted(toResult(await commands.addTab()), toTabList);
    },
    async closeTab(tab) {
      return converted(toResult(await commands.closeTab(tab)), toTabList);
    },
    async renameTab(tab, name) {
      return converted(toResult(await commands.renameTab(tab, name)), toTabList);
    },
    async setTabLanguage(tab, language) {
      return converted(toResult(await commands.setTabLanguage(tab, language)), toTabList);
    },
    async showTab(tab) {
      return converted(toResult(await commands.showTab(tab)), toTabList);
    },
    ...createTauriSettings(),
  };
}

import type { SettingsSource } from "./ChunkSource";
import type {
  ColumnWrite,
  CompareStart,
  Comparison,
  TabLanguage,
  TabList,
  TabTexts,
} from "./compareDomain";
import type { SourceResult, TabId } from "./domain";
import type { MergeRequestSource } from "./MergeRequestSource";

export interface CompareSource extends SettingsSource, MergeRequestSource {
  openCompare(): Promise<SourceResult<CompareStart>>;
  loadTab(tab: TabId): Promise<SourceResult<TabTexts>>;
  setColumn(write: ColumnWrite): Promise<SourceResult<Comparison>>;
  addTab(): Promise<SourceResult<TabList>>;
  closeTab(tab: TabId): Promise<SourceResult<TabList>>;
  renameTab(tab: TabId, name: string): Promise<SourceResult<TabList>>;
  setTabLanguage(tab: TabId, language: TabLanguage): Promise<SourceResult<TabList>>;
  showTab(tab: TabId): Promise<SourceResult<TabList>>;
}

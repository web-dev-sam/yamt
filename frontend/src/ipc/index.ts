import { createLog } from "./log";
import { forwardLog } from "./tauri";
import { guardWindowClose } from "./window";

export type { ChunkSource, SettingsSource, WriteRequest } from "./ChunkSource";
export type { CompareSource } from "./CompareSource";
export type {
  Column,
  ColumnVersions,
  Comparison,
  Difference,
  TabEntry,
  TabLanguage,
  TabList,
  TabTexts,
} from "./compareDomain";
export type {
  AddedServer,
  AgentSettings,
  Antialiasing,
  Chunk,
  ClipboardSelection,
  ColumnVersion,
  ContinueReply,
  DiskChange,
  DiskResult,
  DiskVersion,
  FileEntry,
  FileMergeData,
  FileSides,
  HostEvent,
  KeysChange,
  LanguageServerSettings,
  Listing,
  NotText,
  OperationKind,
  OperationView,
  ProgramFolders,
  ProgramFound,
  ProgressView,
  ProjectFile,
  RangeFileId,
  RepositoryAnswer,
  RunId,
  ServerCommand,
  ServerContext,
  SettingsRead,
  Side,
  SideContent,
  SideName,
  SideNames,
  SourceFailure,
  SourceResult,
  StartReply,
  StoredSettings,
  TabId,
  Theme,
  WriteReply,
} from "./domain";
export { nextColumnVersion } from "./domain";
export { createFixtureSource, loadFixture } from "./fixture";
export { createFixtureCompareSource, loadCompareFixture } from "./fixtureCompare";
export { createFixtureRangeSource } from "./fixtureRange";
export { createFixtureServerHost } from "./fixtureServers";
export {
  bindingsOf,
  DEFAULT_KEYS,
  isLetter,
  isLinux,
  isMac,
  KEY_ACTIONS,
  keyLabel,
  keyOfEvent,
  keyText,
  parseKey,
  pressesKey,
  sameKey,
  type Key,
  type KeyAction,
  type KeyBindings,
  type KeyName,
  type KeyProblem,
  type KeysRead,
} from "./keys";
export type {
  RangeChange,
  RangeEntry,
  RangeEntryKind,
  RangeFile,
  RangeLineCounts,
  RangeModeChange,
  RangeSide,
  RangeSides,
  RangeStart,
} from "./rangeDomain";
export type { RangeSource } from "./RangeSource";
export { createTauriServerHost, createTauriSource, readClipboard } from "./tauri";
export { THEMES, themeKind, themeOf, themeRows } from "./themes";
export { createTauriCompareSource } from "./tauriCompare";
export {
  changedThreadLine,
  shownColumn,
  shownLine,
  unchangedThreadLine,
  type ThreadLine,
} from "./threadLine";
export { createTauriRangeSource } from "./tauriRange";
export type { ServerHost } from "./ServerHost";
export type { SideWords } from "./words";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";

export const log = createLog(IN_APP ? forwardLog : undefined);

export function onWindowClose(mayClose: () => Promise<boolean>): Promise<void> {
  return IN_APP ? guardWindowClose(mayClose) : Promise.resolve();
}

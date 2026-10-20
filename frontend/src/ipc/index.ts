import { createLog } from "./log";
import { forwardLog } from "./tauri";
import { guardWindowClose } from "./window";

export type { ChunkSource, SettingsSource, WriteRequest } from "./ChunkSource";
export type {
  AddedServer,
  Antialiasing,
  Chunk,
  DiskChange,
  DiskResult,
  DiskVersion,
  FileEntry,
  FileList,
  FileMergeData,
  FileSides,
  HostEvent,
  KeysChange,
  LanguageServerSettings,
  NotText,
  ProgramFolders,
  ProgramFound,
  ProjectFile,
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
  Theme,
  WriteReply,
} from "./domain";
export { createFixtureSource, loadFixture } from "./fixture";
export { createFixtureServerHost } from "./fixtureServers";
export {
  bindingsOf,
  DEFAULT_KEYS,
  isLetter,
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
export { createTauriServerHost, createTauriSource } from "./tauri";
export type { ServerHost } from "./ServerHost";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";

export const log = createLog(IN_APP ? forwardLog : undefined);

export function onWindowClose(mayClose: () => Promise<boolean>): Promise<void> {
  return IN_APP ? guardWindowClose(mayClose) : Promise.resolve();
}

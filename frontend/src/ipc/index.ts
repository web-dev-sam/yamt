import { createLog } from "./log";
import { forwardLog } from "./tauri";
import { guardWindowClose } from "./window";

export type { ChunkSource } from "./ChunkSource";
export type {
  Chunk,
  DiskChange,
  DiskResult,
  DiskVersion,
  FileEntry,
  FileList,
  FileMergeData,
  FileSides,
  KeysChange,
  NotText,
  RemoteName,
  SettingsRead,
  Side,
  SideContent,
  SourceFailure,
  SourceResult,
  StoredSettings,
  Theme,
  WriteReply,
} from "./domain";
export { createFixtureSource, loadFixture } from "./fixture";
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
  sameKey,
  type Key,
  type KeyAction,
  type KeyBindings,
  type KeyProblem,
  type KeysRead,
} from "./keys";
export { createTauriSource } from "./tauri";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";

export const log = createLog(IN_APP ? forwardLog : undefined);

export function onWindowClose(mayClose: () => Promise<boolean>): Promise<void> {
  return IN_APP ? guardWindowClose(mayClose) : Promise.resolve();
}

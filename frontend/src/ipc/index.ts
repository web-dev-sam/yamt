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
  NotText,
  RemoteName,
  Side,
  SideContent,
  SourceFailure,
  SourceResult,
  WriteReply,
} from "./domain";
export { createFixtureSource, loadFixture } from "./fixture";
export { createTauriSource } from "./tauri";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";

export const log = createLog(IN_APP ? forwardLog : undefined);

export function onWindowClose(mayClose: () => Promise<boolean>): Promise<void> {
  return IN_APP ? guardWindowClose(mayClose) : Promise.resolve();
}

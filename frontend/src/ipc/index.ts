import { createLog } from "./log";
import { forwardLog } from "./tauri";

export type { ChunkSource } from "./ChunkSource";
export type { Chunk, FileEntry, FileMergeData, SourceFailure, SourceResult } from "./domain";
export { createFixtureSource, loadFixture } from "./fixture";
export { createTauriSource } from "./tauri";

export const log = createLog(
  import.meta.env.VITE_CHUNK_SOURCE === "tauri" ? forwardLog : undefined,
);

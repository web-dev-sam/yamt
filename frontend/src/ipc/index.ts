import { createLog } from "./log";

export type { ChunkSource } from "./ChunkSource";
export type { Chunk, FileEntry, FileMergeData } from "./domain";
export { createFixtureSource } from "./fixture";

export const log = createLog();

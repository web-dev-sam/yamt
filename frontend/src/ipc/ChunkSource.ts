import type { FileEntry, FileMergeData } from "./domain";

export interface ChunkSource {
  listFiles(): Promise<FileEntry[]>;
  loadFile(path: string): Promise<FileMergeData>;
  finishFile(path: string, text: string): Promise<FileEntry[]>;
  resetFile(path: string): Promise<FileMergeData>;
}

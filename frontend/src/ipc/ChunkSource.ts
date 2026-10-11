import type { FileEntry, FileMergeData, FileSides, Side, SourceResult } from "./domain";

export interface ChunkSource {
  listFiles(): Promise<FileEntry[]>;
  loadFile(path: string): Promise<SourceResult<FileMergeData>>;
  finishFile(path: string, text: string): Promise<SourceResult<FileEntry[]>>;
  resetFile(path: string): Promise<SourceResult<FileEntry[]>>;
  describeFile(path: string): Promise<SourceResult<FileSides>>;
  takeSide(path: string, side: Side): Promise<SourceResult<FileEntry[]>>;
}

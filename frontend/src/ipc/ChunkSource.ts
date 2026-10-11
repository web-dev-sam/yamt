import type {
  DiskVersion,
  FileList,
  FileMergeData,
  FileSides,
  RemoteName,
  Side,
  SourceResult,
  WriteReply,
} from "./domain";

export interface ChunkSource {
  listFiles(): Promise<SourceResult<FileList>>;
  loadFile(path: string): Promise<SourceResult<FileMergeData>>;
  finishFile(request: {
    readonly path: string;
    readonly text: string;
    readonly diskVersion: DiskVersion;
  }): Promise<SourceResult<WriteReply>>;
  resetFile(path: string, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>;
  describeFile(path: string): Promise<SourceResult<FileSides>>;
  takeSide(path: string, side: Side, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>;
  remoteName(): Promise<RemoteName | null>;
}

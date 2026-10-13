import type {
  Antialiasing,
  DiskVersion,
  FileList,
  FileMergeData,
  FileSides,
  KeysChange,
  RemoteName,
  SettingsRead,
  Side,
  SourceResult,
  StoredSettings,
  Theme,
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
  loadSettings(current: StoredSettings): Promise<SourceResult<SettingsRead>>;
  setTheme(current: StoredSettings, theme: Theme): Promise<SourceResult<SettingsRead>>;
  setAntialiasing(
    current: StoredSettings,
    antialiasing: Antialiasing,
  ): Promise<SourceResult<SettingsRead>>;
  setKeys(
    current: StoredSettings,
    changes: readonly KeysChange[],
  ): Promise<SourceResult<SettingsRead>>;
  moveSettings(current: StoredSettings, path: string): Promise<SourceResult<SettingsRead>>;
}

export type SettingsSource = Pick<
  ChunkSource,
  "loadSettings" | "setTheme" | "setAntialiasing" | "setKeys" | "moveSettings"
>;

import type {
  Antialiasing,
  DiskVersion,
  FileList,
  FileMergeData,
  FileSides,
  KeysChange,
  SettingsRead,
  Side,
  SideNames,
  SourceResult,
  StoredSettings,
  Theme,
  WriteReply,
} from "./domain";

export type LanguageServerSettings = StoredSettings["languageServers"];
export type RepositoryAnswer = LanguageServerSettings["repositories"][string];
export type AddedServer = LanguageServerSettings["added"][number];

export interface ChunkSource {
  listFiles(): Promise<SourceResult<FileList>>;
  loadFile(path: string): Promise<SourceResult<FileMergeData>>;
  finishFile(request: {
    readonly path: string;
    readonly text: string;
    readonly diskVersion: DiskVersion;
  }): Promise<SourceResult<WriteReply>>;
  saveFile(request: {
    readonly path: string;
    readonly text: string;
    readonly diskVersion: DiskVersion;
  }): Promise<SourceResult<WriteReply>>;
  resetFile(path: string, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>;
  describeFile(path: string): Promise<SourceResult<FileSides>>;
  takeSide(path: string, side: Side, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>;
  sideNames(): Promise<SideNames>;
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
  setServerAnswer(
    current: StoredSettings,
    answer: RepositoryAnswer | null,
  ): Promise<SourceResult<SettingsRead>>;
  setAddedServers(
    current: StoredSettings,
    added: readonly AddedServer[],
  ): Promise<SourceResult<SettingsRead>>;
}

export type SettingsSource = Pick<
  ChunkSource,
  | "loadSettings"
  | "setTheme"
  | "setAntialiasing"
  | "setKeys"
  | "moveSettings"
  | "setServerAnswer"
  | "setAddedServers"
>;

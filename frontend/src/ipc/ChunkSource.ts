import type {
  AddedServer,
  AgentSettings,
  Antialiasing,
  ContinueReply,
  DiskVersion,
  FileMergeData,
  FileSides,
  KeysChange,
  Listing,
  RepositoryAnswer,
  SettingsRead,
  Side,
  SourceResult,
  StoredSettings,
  Theme,
  WriteReply,
} from "./domain";
import type { AbortReply, PushReply } from "./mergeRequestDomain";

export type WriteRequest = {
  readonly path: string;
  readonly text: string;
  readonly diskVersion: DiskVersion;
};

export interface ChunkSource {
  loadFile(path: string): Promise<SourceResult<FileMergeData>>;
  finishFile(request: WriteRequest): Promise<SourceResult<WriteReply>>;
  saveFile(request: WriteRequest): Promise<SourceResult<WriteReply>>;
  resetFile(path: string, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>;
  describeFile(path: string): Promise<SourceResult<FileSides>>;
  takeSide(path: string, side: Side, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>;
  listStop(): Promise<SourceResult<Listing>>;
  continueOperation(): Promise<SourceResult<ContinueReply>>;
  abortOperation(): Promise<SourceResult<AbortReply>>;
  pushMergedBranch(): Promise<SourceResult<PushReply>>;
  closeEndedMerge(): Promise<SourceResult<null>>;
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
  setServerSwitch(
    current: StoredSettings,
    server: string,
    on: boolean,
  ): Promise<SourceResult<SettingsRead>>;
  setAddedServers(
    current: StoredSettings,
    added: readonly AddedServer[],
  ): Promise<SourceResult<SettingsRead>>;
  setAgent(current: StoredSettings, agent: AgentSettings): Promise<SourceResult<SettingsRead>>;
}

export type SettingsSource = Pick<
  ChunkSource,
  | "loadSettings"
  | "setTheme"
  | "setAntialiasing"
  | "setKeys"
  | "moveSettings"
  | "setServerAnswer"
  | "setServerSwitch"
  | "setAddedServers"
  | "setAgent"
>;

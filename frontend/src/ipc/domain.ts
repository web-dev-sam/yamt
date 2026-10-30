import type * as Generated from "./bindings";
import { branded, invalid, isNonNegativeInteger } from "./validate";
import { toSideWords, type SideWords } from "./words";

export type TabId = number & { readonly __brand: "TabId" };
export type ColumnVersion = number & { readonly __brand: "ColumnVersion" };
export type LeftLine = number & { readonly __brand: "LeftLine" };
export type RightLine = number & { readonly __brand: "RightLine" };
export type RangeFileId = number & { readonly __brand: "RangeFileId" };
export type ThreadId = number & { readonly __brand: "ThreadId" };
export type MessageId = number & { readonly __brand: "MessageId" };

type MiddleLine = number & { readonly __brand: "MiddleLine" };
export type DiskVersion = number & { readonly __brand: "DiskVersion" };
type LocalLine = number & { readonly __brand: "LocalLine" };
type RemoteLine = number & { readonly __brand: "RemoteLine" };
type ChunkId = number & { readonly __brand: "ChunkId" };
export type LineRange<L> = { readonly start: L; readonly len: number };
type ChunkWords = { readonly local: SideWords<LocalLine>; readonly remote: SideWords<RemoteLine> };

export type Chunk = {
  readonly id: ChunkId;
  readonly kind: Generated.ChunkKind;
  readonly middle: LineRange<MiddleLine>;
  readonly local: LineRange<LocalLine>;
  readonly remote: LineRange<RemoteLine>;
  readonly words: ChunkWords;
  readonly waiting: Generated.Waiting;
};

export type FileEntry = Generated.FileEntry;

export type FileSides = Omit<Generated.FileSides, "disk_version"> & {
  readonly diskVersion: DiskVersion;
};

export type SideContent = Generated.SideContent;
export type Side = Generated.Side;
export type SideName = Generated.SideName;
export type SideNames = Generated.SideNames;
export type NotText = Generated.NotText;
export type DiskResult = Generated.DiskResult;
export type DiskChange = Generated.DiskChange;
export type WriteReply = Generated.WriteReply;
export type Theme = Generated.Theme;
export type Antialiasing = Generated.Antialiasing;
export type ClipboardSelection = Generated.ClipboardSelection;

export type LanguageServerSettings = Required<Generated.LanguageServerSettings>;

export type StoredSettings = Omit<Generated.StoredSettings, "languageServers"> & {
  languageServers: LanguageServerSettings;
};

export type KeysChange = Generated.KeysChange;
export type RepositoryAnswer = Generated.RepositoryAnswer;
export type AddedServer = Generated.AddedServer;
export type AgentSettings = Generated.AgentSettings;

export type RunId = number & { readonly __brand: "RunId" };
export type AgentRun = number & { readonly __brand: "AgentRun" };
export type CheckoutFolder = string & { readonly __brand: "CheckoutFolder" };
export type AgentSessionId = string & { readonly __brand: "AgentSessionId" };
export type MergeRequestIid = number & { readonly __brand: "MergeRequestIid" };
export type JobPage = string & { readonly __brand: "JobPage" };

export type ProgramFolders = Readonly<Record<keyof Generated.ProgramFolders, readonly string[]>>;
export type ServerCommand = Omit<Generated.ServerCommand, "args" | "folders"> & {
  readonly args: readonly string[];
  readonly folders: ProgramFolders;
};

export type HostEvent = Generated.HostEvent;

export type StartReply =
  | Exclude<Generated.StartReply, { kind: "Started" }>
  | { readonly kind: "Started"; readonly run: RunId };

export type ServerContext = Generated.ServerContext;

export type ProgramFound = Generated.ProgramFound;

export type ProjectFile = Generated.ProjectFile;

export type SettingsRead = {
  readonly path: string;
  readonly defaultPath: string;
  readonly stored: StoredSettings;
};

export type OperationView = Generated.OperationView;

export type ProgressView = Generated.ProgressView;

export type OperationKind = OperationView["kind"];

export type Listing =
  | {
      readonly kind: "Files";
      readonly files: readonly FileEntry[];
      readonly diskChanges: readonly DiskChange[];
      readonly operation: OperationView | null;
      readonly sides: SideNames;
    }
  | { readonly kind: "MovedOn" };

export type ContinueReply = Generated.ContinueReply;

export type FileMergeData = {
  readonly path: string;
  readonly middle: Generated.Middle;
  readonly local: string;
  readonly remote: string;
  readonly deleted: Side | null;
  readonly eol: Generated.Eol;
  readonly chunks: readonly Chunk[];
  readonly diskVersion: DiskVersion;
};

export type SourceFailure = Generated.IpcError;

export type SourceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: SourceFailure };

function isMiddleLine(n: number): n is MiddleLine {
  return isNonNegativeInteger(n);
}

function isDiskVersion(n: number): n is DiskVersion {
  return isNonNegativeInteger(n);
}

function isLocalLine(n: number): n is LocalLine {
  return isNonNegativeInteger(n);
}

function isRemoteLine(n: number): n is RemoteLine {
  return isNonNegativeInteger(n);
}

function isChunkId(n: number): n is ChunkId {
  return isNonNegativeInteger(n);
}

function isRunId(n: number): n is RunId {
  return isNonNegativeInteger(n);
}

export function isAgentRun(n: number): n is AgentRun {
  return isNonNegativeInteger(n);
}

const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/u;

export function isCheckoutFolder(path: string): path is CheckoutFolder {
  return ABSOLUTE_PATH.test(path);
}

export function isAgentSessionId(text: string): text is AgentSessionId {
  return text !== "";
}

export function agentSessionId(text: string): AgentSessionId | null {
  return isAgentSessionId(text) ? text : null;
}

export function isTabId(n: number): n is TabId {
  return isNonNegativeInteger(n);
}

export function isColumnVersion(n: number): n is ColumnVersion {
  return isNonNegativeInteger(n);
}

export function isLeftLine(n: number): n is LeftLine {
  return isNonNegativeInteger(n);
}

export function isRightLine(n: number): n is RightLine {
  return isNonNegativeInteger(n);
}

export function isRangeFileId(value: number): value is RangeFileId {
  return isNonNegativeInteger(value);
}

export function isThreadId(value: number): value is ThreadId {
  return isNonNegativeInteger(value);
}

export function isMessageId(value: number): value is MessageId {
  return isNonNegativeInteger(value);
}

export function isMergeRequestIid(value: number): value is MergeRequestIid {
  return isNonNegativeInteger(value);
}

export function isJobPage(text: string): text is JobPage {
  return text.startsWith("https://");
}

export function nextColumnVersion(version: ColumnVersion): ColumnVersion {
  return branded(version + 1, isColumnVersion, "version");
}

function toWords({
  words,
  chunkId,
  field,
}: {
  words: Generated.WordChanges;
  chunkId: ChunkId;
  field: string;
}): ChunkWords {
  if (words.chunk !== chunkId) {
    throw new Error(`${field}.chunk must be ${chunkId}, got ${words.chunk}`);
  }
  return {
    local: toSideWords({ side: words.local, isLine: isLocalLine, field: `${field}.local` }),
    remote: toSideWords({ side: words.remote, isLine: isRemoteLine, field: `${field}.remote` }),
  };
}

export function toRange<L extends number>({
  range,
  isLine,
  field,
}: {
  range: Generated.LineRange<number>;
  isLine: (n: number) => n is L;
  field: string;
}): LineRange<L> {
  const start = branded(range.start, isLine, `${field}.start`);
  const { len } = range;
  if (!isNonNegativeInteger(len)) {
    throw invalid(`${field}.len`, len);
  }
  return { start, len };
}

function toChunk(merged: Generated.MergeChunk, index: number): Chunk {
  const field = `chunks[${index}]`;
  const { chunk } = merged;
  const id = branded(chunk.id, isChunkId, `${field}.chunk.id`);
  return {
    id,
    kind: chunk.kind,
    middle: toRange({ range: merged.middle, isLine: isMiddleLine, field: `${field}.middle` }),
    local: toRange({ range: chunk.local, isLine: isLocalLine, field: `${field}.chunk.local` }),
    remote: toRange({ range: chunk.remote, isLine: isRemoteLine, field: `${field}.chunk.remote` }),
    words: toWords({ words: merged.words, chunkId: id, field: `${field}.words` }),
    waiting: merged.waiting,
  };
}

export function toDomain(dto: Generated.FileMergeData): FileMergeData {
  return {
    path: dto.path,
    middle: dto.middle,
    local: dto.local,
    remote: dto.remote,
    deleted: dto.deleted,
    eol: dto.eol,
    chunks: dto.chunks.map(toChunk),
    diskVersion: branded(dto.disk_version, isDiskVersion, "disk_version"),
  };
}

export function toSides(dto: Generated.FileSides): FileSides {
  const { disk_version: diskVersion, ...sides } = dto;
  return { ...sides, diskVersion: branded(diskVersion, isDiskVersion, "disk_version") };
}

export function toListing(dto: Generated.Listing): Listing {
  if (dto.kind === "MovedOn") {
    return dto;
  }
  const { files, disk_changes: diskChanges, operation, sides } = dto;
  return { kind: "Files", files, diskChanges, operation, sides };
}

export function toSettingsRead(dto: Generated.SettingsRead): SettingsRead {
  const { languageServers } = dto.stored;
  const stored = {
    ...dto.stored,
    languageServers: { ...languageServers, off: languageServers.off ?? {} },
  };
  return { path: dto.path, defaultPath: dto.default_path, stored };
}

export function toStartReply(dto: Generated.StartReply): StartReply {
  if (dto.kind !== "Started") {
    return dto;
  }
  return { kind: "Started", run: branded(dto.run, isRunId, "run") };
}

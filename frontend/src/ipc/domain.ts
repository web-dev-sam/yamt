import type * as Generated from "./bindings";
import { invalid, isNonNegativeInteger } from "./validate";
import { toSideWords, type SideWords } from "./words";

type MiddleLine = number & { readonly __brand: "MiddleLine" };
export type DiskVersion = number & { readonly __brand: "DiskVersion" };
type LocalLine = number & { readonly __brand: "LocalLine" };
type RemoteLine = number & { readonly __brand: "RemoteLine" };
type ChunkId = number & { readonly __brand: "ChunkId" };
type LineRange<L> = { readonly start: L; readonly len: number };
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

export type LanguageServerSettings = Required<Generated.LanguageServerSettings>;

export type StoredSettings = Omit<Generated.StoredSettings, "languageServers"> & {
  languageServers: LanguageServerSettings;
};

export type KeysChange = Generated.KeysChange;

export type RepositoryAnswer = Generated.RepositoryAnswer;

export type AddedServer = Generated.AddedServer;

export type RunId = number & { readonly __brand: "RunId" };

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

function toRange<L extends number>({
  range,
  isLine,
  field,
}: {
  range: Generated.LineRange<number>;
  isLine: (n: number) => n is L;
  field: string;
}): LineRange<L> {
  const { start, len } = range;
  if (!isLine(start)) {
    throw invalid(`${field}.start`, start);
  }
  if (!isNonNegativeInteger(len)) {
    throw invalid(`${field}.len`, len);
  }
  return { start, len };
}

function toChunk(merged: Generated.MergeChunk, index: number): Chunk {
  const field = `chunks[${index}]`;
  const { chunk } = merged;
  const { id } = chunk;
  if (!isChunkId(id)) {
    throw invalid(`${field}.chunk.id`, id);
  }
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

function toDiskVersion(n: number, field: string): DiskVersion {
  if (!isDiskVersion(n)) {
    throw invalid(field, n);
  }
  return n;
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
    diskVersion: toDiskVersion(dto.disk_version, "disk_version"),
  };
}

export function toSides(dto: Generated.FileSides): FileSides {
  const { disk_version: diskVersion, ...sides } = dto;
  return { ...sides, diskVersion: toDiskVersion(diskVersion, "disk_version") };
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
  const { run } = dto;
  if (!isRunId(run)) {
    throw invalid("run", run);
  }
  return { kind: "Started", run };
}

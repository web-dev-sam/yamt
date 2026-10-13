import type * as Generated from "./bindings";

type MiddleLine = number & { readonly __brand: "MiddleLine" };
export type DiskVersion = number & { readonly __brand: "DiskVersion" };
type LocalLine = number & { readonly __brand: "LocalLine" };
type RemoteLine = number & { readonly __brand: "RemoteLine" };
type ChunkId = number & { readonly __brand: "ChunkId" };
type LineRange<L> = { readonly start: L; readonly len: number };
type InlineRange<L> = { readonly line: L; readonly start: number; readonly len: number };
type InlinePoint<L> = { readonly line: L; readonly column: number };
type SideWords<L> = {
  readonly changed: readonly InlineRange<L>[];
  readonly removedAt: readonly InlinePoint<L>[];
};
type ChunkWords = { readonly local: SideWords<LocalLine>; readonly remote: SideWords<RemoteLine> };

export type Chunk = {
  readonly id: ChunkId;
  readonly kind: Generated.ChunkKind;
  readonly middle: LineRange<MiddleLine>;
  readonly local: LineRange<LocalLine>;
  readonly remote: LineRange<RemoteLine>;
  readonly words: ChunkWords;
};

export type FileEntry = Generated.FileEntry;

export type FileSides = Omit<Generated.FileSides, "disk_version"> & {
  readonly diskVersion: DiskVersion;
};

export type SideContent = Generated.SideContent;

export type Side = Generated.Side;

export type RemoteName = Generated.RemoteName;

export type NotText = Generated.NotText;

export type DiskResult = Generated.DiskResult;

export type DiskChange = Generated.DiskChange;

export type WriteReply = Generated.WriteReply;

export type Theme = Generated.Theme;

export type Antialiasing = Generated.Antialiasing;

export type StoredSettings = Generated.StoredSettings;

export type KeysChange = Generated.KeysChange;

export type SettingsRead = {
  readonly path: string;
  readonly defaultPath: string;
  readonly stored: StoredSettings;
};

export type FileList = {
  readonly files: readonly FileEntry[];
  readonly diskChanges: readonly DiskChange[];
};

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

function isNonNegativeInteger(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

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

function invalid(field: string, value: number): Error {
  return new Error(`${field} must be a non-negative safe integer, got ${value}`);
}

function toInlineRange<L extends number>({
  range,
  isLine,
  field,
}: {
  range: Generated.InlineRange<number>;
  isLine: (n: number) => n is L;
  field: string;
}): InlineRange<L> {
  const { line, start, len } = range;
  if (!isLine(line)) {
    throw invalid(`${field}.line`, line);
  }
  if (!isNonNegativeInteger(start)) {
    throw invalid(`${field}.start`, start);
  }
  if (!Number.isSafeInteger(len) || len <= 0) {
    throw new Error(`${field}.len must be a positive safe integer, got ${len}`);
  }
  return { line, start, len };
}

function toInlinePoint<L extends number>({
  point,
  isLine,
  field,
}: {
  point: Generated.InlinePoint<number>;
  isLine: (n: number) => n is L;
  field: string;
}): InlinePoint<L> {
  const { line, column } = point;
  if (!isLine(line)) {
    throw invalid(`${field}.line`, line);
  }
  if (!isNonNegativeInteger(column)) {
    throw invalid(`${field}.column`, column);
  }
  return { line, column };
}

function toSideWords<L extends number>({
  side,
  isLine,
  field,
}: {
  side: Generated.SideWordChanges<number>;
  isLine: (n: number) => n is L;
  field: string;
}): SideWords<L> {
  return {
    changed: side.changed.map((range, index) =>
      toInlineRange({ range, isLine, field: `${field}.changed[${index}]` }),
    ),
    removedAt: side.removed_at.map((point, index) =>
      toInlinePoint({ point, isLine, field: `${field}.removed_at[${index}]` }),
    ),
  };
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

export function toFileList(dto: Generated.FileList): FileList {
  return { files: dto.files, diskChanges: dto.disk_changes };
}

export function toSettingsRead(dto: Generated.SettingsRead): SettingsRead {
  return { path: dto.path, defaultPath: dto.default_path, stored: dto.stored };
}

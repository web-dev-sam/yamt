import type * as Generated from "./bindings";

type BaseLine = number & { readonly __brand: "BaseLine" };
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
  readonly base: LineRange<BaseLine>;
  readonly local: LineRange<LocalLine>;
  readonly remote: LineRange<RemoteLine>;
  readonly words: ChunkWords;
};

export type FileEntry = Generated.FileEntry;

export type FileMergeData = {
  readonly path: string;
  readonly base: string;
  readonly local: string;
  readonly remote: string;
  readonly eol: Generated.Eol;
  readonly chunks: readonly Chunk[];
};

function isNonNegativeInteger(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

function isBaseLine(n: number): n is BaseLine {
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

function toChunk({
  chunk,
  words,
  index,
}: {
  chunk: Generated.Chunk;
  words: Generated.WordChanges;
  index: number;
}): Chunk {
  const field = `chunks[${index}]`;
  const { id } = chunk;
  if (!isChunkId(id)) {
    throw invalid(`${field}.id`, id);
  }
  return {
    id,
    kind: chunk.kind,
    base: toRange({ range: chunk.base, isLine: isBaseLine, field: `${field}.base` }),
    local: toRange({ range: chunk.local, isLine: isLocalLine, field: `${field}.local` }),
    remote: toRange({ range: chunk.remote, isLine: isRemoteLine, field: `${field}.remote` }),
    words: toWords({ words, chunkId: id, field: `word_changes[${index}]` }),
  };
}

function toChunks(dto: Generated.FileMergeData): Chunk[] {
  const misaligned = `word_changes must have one entry per chunk (${dto.chunks.length}), got ${dto.word_changes.length}`;
  if (dto.word_changes.length > dto.chunks.length) {
    throw new Error(misaligned);
  }
  return dto.chunks.map((chunk, index) => {
    const words = dto.word_changes[index];
    if (words === undefined) {
      throw new Error(misaligned);
    }
    return toChunk({ chunk, words, index });
  });
}

export function toDomain(dto: Generated.FileMergeData): FileMergeData {
  return {
    path: dto.path,
    base: dto.base,
    local: dto.local,
    remote: dto.remote,
    eol: dto.eol,
    chunks: toChunks(dto),
  };
}

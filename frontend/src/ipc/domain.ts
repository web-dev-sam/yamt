import type * as Generated from "./bindings";

type BaseLine = number & { readonly __brand: "BaseLine" };
type LocalLine = number & { readonly __brand: "LocalLine" };
type RemoteLine = number & { readonly __brand: "RemoteLine" };
type ChunkId = number & { readonly __brand: "ChunkId" };
type LineRange<L> = { readonly start: L; readonly len: number };

export type Chunk = {
  readonly id: ChunkId;
  readonly kind: Generated.ChunkKind;
  readonly base: LineRange<BaseLine>;
  readonly local: LineRange<LocalLine>;
  readonly remote: LineRange<RemoteLine>;
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

function toChunk(dto: Generated.Chunk, field: string): Chunk {
  const { id } = dto;
  if (!isChunkId(id)) {
    throw invalid(`${field}.id`, id);
  }
  return {
    id,
    kind: dto.kind,
    base: toRange({ range: dto.base, isLine: isBaseLine, field: `${field}.base` }),
    local: toRange({ range: dto.local, isLine: isLocalLine, field: `${field}.local` }),
    remote: toRange({ range: dto.remote, isLine: isRemoteLine, field: `${field}.remote` }),
  };
}

export function toDomain(dto: Generated.FileMergeData): FileMergeData {
  return {
    path: dto.path,
    base: dto.base,
    local: dto.local,
    remote: dto.remote,
    eol: dto.eol,
    chunks: dto.chunks.map((chunk, index) => toChunk(chunk, `chunks[${index}]`)),
  };
}

import type { SettingsSource } from "./ChunkSource";
import type { RangeFileId, SourceResult } from "./domain";
import type { RangeFile, RangeStart, SearchTexts } from "./rangeDomain";
import type { ReviewSource } from "./ReviewSource";

export interface RangeSource extends SettingsSource, ReviewSource {
  openRange(): Promise<SourceResult<RangeStart>>;
  loadRangeFile(file: RangeFileId): Promise<SourceResult<RangeFile>>;
  searchTexts(from: RangeFileId): Promise<SourceResult<SearchTexts>>;
}

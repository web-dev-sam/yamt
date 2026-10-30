import type { SettingsSource } from "./ChunkSource";
import type { RangeFileId, SourceResult } from "./domain";
import type { MergeRequestSource } from "./MergeRequestSource";
import type { RangeFile, RangeStart, SearchTexts } from "./rangeDomain";
import type { ReviewSource } from "./ReviewSource";

export interface RangeSource extends SettingsSource, ReviewSource, MergeRequestSource {
  openRange(): Promise<SourceResult<RangeStart>>;
  loadRangeFile(file: RangeFileId): Promise<SourceResult<RangeFile>>;
  searchTexts(from: RangeFileId): Promise<SourceResult<SearchTexts>>;
}

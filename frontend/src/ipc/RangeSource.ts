import type { SettingsSource } from "./ChunkSource";
import type { RangeFileId, SourceResult } from "./domain";
import type { RangeFile, RangeStart } from "./rangeDomain";

export interface RangeSource extends SettingsSource {
  openRange(): Promise<SourceResult<RangeStart>>;
  loadRangeFile(file: RangeFileId): Promise<SourceResult<RangeFile>>;
}

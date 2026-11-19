import type { RangeFileId, SourceResult } from "./domain";
import type { ReviewMarks, SinceReview } from "./reviewedDomain";

export interface ReviewedSource {
  listReviewed(): Promise<SourceResult<ReviewMarks>>;
  markReviewed(file: RangeFileId): Promise<SourceResult<null>>;
  unmarkReviewed(file: RangeFileId): Promise<SourceResult<null>>;
  loadSinceReview(file: RangeFileId): Promise<SourceResult<SinceReview>>;
}

import { commands } from "./bindings";
import { toReviewMarks, toSinceReview } from "./reviewedDomain";
import type { ReviewedSource } from "./ReviewedSource";
import { converted, toResult } from "./tauri";

export function createTauriReviewed(): ReviewedSource {
  return {
    async listReviewed() {
      return converted(toResult(await commands.listReviewed()), toReviewMarks);
    },
    async markReviewed(file) {
      return toResult(await commands.markReviewed(file));
    },
    async unmarkReviewed(file) {
      return toResult(await commands.unmarkReviewed(file));
    },
    async loadSinceReview(file) {
      return converted(toResult(await commands.loadSinceReview(file)), toSinceReview);
    },
  };
}

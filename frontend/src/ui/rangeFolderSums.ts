import type { RangeEntry, RangeLineCounts } from "../ipc";
import { folderPaths } from "./fileTree";

type Counted = Extract<RangeLineCounts, { kind: "counted" }>;

/** Git's counts summed per folder over every counted file below it, at any depth, keyed by the folder's full path as
 *  `folderPaths` names it — the path a tree folder row carries, a joined chain's deepest folder included. A
 *  `notCounted` file adds nothing; a folder with no counted file below it has no entry. */
export function folderSums(
  files: readonly Pick<RangeEntry, "path" | "lines">[],
): ReadonlyMap<string, Counted> {
  const sums = new Map<string, Counted>();
  for (const { path, lines } of files) {
    if (lines.kind === "notCounted") {
      continue;
    }
    for (const folder of folderPaths(path)) {
      const sum = sums.get(folder);
      sums.set(folder, {
        kind: "counted",
        added: (sum?.added ?? 0) + lines.added,
        removed: (sum?.removed ?? 0) + lines.removed,
      });
    }
  }
  return sums;
}

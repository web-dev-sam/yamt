import type { ShallowRef } from "vue";

import { log, type ChunkSource, type FileEntry, type SideNames } from "../ipc";
import { applyDiskChanges, type DiskChangeTarget } from "./diskChanges";
import type { Notice } from "./noticeText";
import { attempt, report, unexpected } from "./problem";

type Listing = DiskChangeTarget & { readonly files: ShallowRef<readonly FileEntry[]> };

type SideNamesTarget = {
  readonly source: ChunkSource;
  readonly sideNames: ShallowRef<SideNames>;
};

export async function refreshFiles(
  listing: Listing,
  when: Notice["when"],
): Promise<readonly FileEntry[] | null> {
  const listed = await attempt(() => listing.source.listFiles());
  if (!listed.ok) {
    report(listing, { action: "list", cause: listed.cause });
    return null;
  }
  const { files, diskChanges } = listed.value;
  listing.files.value = files;
  if (listing.problem.value?.action === "list") {
    listing.problem.value = null;
  }
  await applyDiskChanges(listing, diskChanges, when);
  return files;
}

export async function loadSideNames(target: SideNamesTarget): Promise<void> {
  try {
    target.sideNames.value = await target.source.sideNames();
  } catch (error) {
    log.warn("store.side_names_failed", { ...unexpected(error) });
  }
}

import type { ShallowRef } from "vue";

import { log, type ChunkSource, type FileEntry, type RemoteName } from "../ipc";
import { applyDiskChanges, type DiskChangeTarget } from "./diskChanges";
import type { Notice } from "./noticeText";
import { attempt, report, unexpected } from "./problem";

type Listing = DiskChangeTarget & { readonly files: ShallowRef<readonly FileEntry[]> };

type RemoteNameTarget = {
  readonly source: ChunkSource;
  readonly remoteName: ShallowRef<RemoteName | null>;
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

export async function loadRemoteName(target: RemoteNameTarget): Promise<void> {
  try {
    target.remoteName.value = await target.source.remoteName();
  } catch (error) {
    log.warn("store.remote_name_failed", { ...unexpected(error) });
  }
}

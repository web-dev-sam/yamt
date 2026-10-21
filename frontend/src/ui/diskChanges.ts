import type { ShallowRef } from "vue";

import { log, type DiskChange } from "../ipc";
import type { CloseGuard } from "./closeGuard";
import type { Stop } from "./currentStop";
import type { DiskNotice, Notice } from "./noticeText";
import type { Relist } from "./problem";
import type { Taken } from "./sides";
import { isShown, reload, takesASide, type Shown } from "./views";

export type DiskChangeTarget = Shown & {
  readonly notices: ShallowRef<readonly Notice[]>;
  readonly taken: ShallowRef<ReadonlyMap<string, Taken>>;
  readonly guard: Pick<CloseGuard, "unsavedFiles">;
};

function logNotice({ path, result, editsDropped, when }: DiskNotice): void {
  const { kind, ...details } = result;
  const fields = { path, result: kind, ...details, editsDropped, when };
  if (kind === "StageFailed") {
    log.warn("file.disk_changed", fields);
  } else {
    log.info("file.disk_changed", fields);
  }
}

function noteDiskChanges(
  target: DiskChangeTarget,
  changes: readonly DiskChange[],
  when: DiskNotice["when"],
): readonly string[] {
  const unsaved = target.guard.unsavedFiles();
  const byPath = new Map(changes.map((change) => [change.path, change.result]));
  const notices = [...byPath].map(([path, result]): DiskNotice => ({
    kind: "disk",
    path,
    result,
    editsDropped: unsaved.includes(path),
    when,
  }));
  notices.forEach(logNotice);
  target.notices.value = [
    ...target.notices.value.filter((notice) => notice.kind !== "disk" || !byPath.has(notice.path)),
    ...notices,
  ];
  const taken = new Map(target.taken.value);
  for (const [path, result] of byPath) {
    taken.delete(path);
    if (result.kind === "Staged" && takesASide(target, path)) {
      taken.set(path, { by: "disk" });
    }
  }
  target.taken.value = taken;
  return [...byPath.keys()].filter((path) => isShown(target, path));
}

export async function applyDiskChanges(
  target: DiskChangeTarget & Relist,
  changes: readonly DiskChange[],
  when: DiskNotice["when"],
  stop: Readonly<Stop>,
): Promise<void> {
  const shown = noteDiskChanges(target, changes, when);
  await Promise.all(shown.map((path) => reload(target, path, stop)));
}

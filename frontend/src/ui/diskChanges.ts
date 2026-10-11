import type { ShallowRef } from "vue";

import { log, type DiskChange } from "../ipc";
import type { CloseGuard } from "./closeGuard";
import type { Notice } from "./noticeText";
import type { Taken } from "./sides";
import { isShown, reload, takesASide, type Shown } from "./views";

export type DiskChangeTarget = Shown & {
  readonly notices: ShallowRef<readonly Notice[]>;
  readonly taken: ShallowRef<ReadonlyMap<string, Taken>>;
  readonly guard: Pick<CloseGuard, "unsavedFiles">;
};

function logNotice({ path, result, editsDropped, when }: Notice): void {
  const { kind, ...details } = result;
  const fields = { path, result: kind, ...details, editsDropped, when };
  if (kind === "StageFailed") {
    log.warn("file.disk_changed", fields);
  } else {
    log.info("file.disk_changed", fields);
  }
}

export async function applyDiskChanges(
  target: DiskChangeTarget,
  changes: readonly DiskChange[],
  when: Notice["when"],
): Promise<void> {
  const unsaved = target.guard.unsavedFiles();
  const byPath = new Map(changes.map((change) => [change.path, change.result]));
  const notices = [...byPath].map(([path, result]): Notice => ({
    path,
    result,
    editsDropped: unsaved.includes(path),
    when,
  }));
  notices.forEach(logNotice);
  target.notices.value = [
    ...target.notices.value.filter((notice) => !byPath.has(notice.path)),
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
  const shown = [...byPath.keys()].filter((path) => isShown(target, path));
  await Promise.all(shown.map((path) => reload(target, path)));
}

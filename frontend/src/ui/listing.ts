import type { ShallowRef } from "vue";

import type { FileEntry, OperationView, SideNames } from "../ipc";
import { landed, type Stop } from "./currentStop";
import { applyDiskChanges, type DiskChangeTarget } from "./diskChanges";
import type { DiskNotice } from "./noticeText";
import { attempt, report, type Relist } from "./problem";
import type { StopEnd } from "./stops";

type ListTarget = DiskChangeTarget &
  Relist & {
    readonly stop: Stop;
    readonly files: ShallowRef<readonly FileEntry[]>;
    readonly operation: ShallowRef<OperationView | null>;
    readonly sideNames: ShallowRef<SideNames>;
    nextStop(end: StopEnd): Promise<void>;
  };

export async function refreshFiles(
  target: ListTarget,
  when: DiskNotice["when"],
): Promise<readonly FileEntry[] | null> {
  const listed = await attempt(() => target.source.listStop());
  if (!listed.ok) {
    report(target, { action: "list", cause: listed.cause });
    return null;
  }
  if (listed.value.kind === "MovedOn") {
    await target.nextStop({ kind: "outside" });
    return null;
  }
  const { files, diskChanges, operation, sides } = listed.value;
  target.files.value = files;
  target.operation.value = operation;
  target.sideNames.value = sides;
  if (target.problem.value?.action === "list") {
    target.problem.value = null;
  }
  const { stop } = target;
  return landed(stop, async () => {
    await applyDiskChanges(target, diskChanges, when, stop);
    return files;
  });
}

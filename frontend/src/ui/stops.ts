import type { ShallowRef } from "vue";

import { log, type FileEntry, type OperationView } from "../ipc";
import type { CloseGuard } from "./closeGuard";
import type { Notice } from "./noticeText";
import { logProblem, type Problem } from "./problem";
import { dropClaims, type Writing } from "./saving";
import type { Screen } from "./screen";
import type { Taken } from "./sides";
import type { Shown } from "./views";

export type StopEnd =
  | { readonly kind: "outside" }
  | { readonly kind: "continued"; readonly message: string };

export type StopTarget = Pick<Shown, "opened" | "choices" | "problem"> &
  Writing & {
    readonly taken: ShallowRef<ReadonlyMap<string, Taken>>;
    readonly notices: ShallowRef<readonly Notice[]>;
    readonly active: ShallowRef<string | null>;
    readonly screen: ShallowRef<Screen>;
    readonly operation: Readonly<ShallowRef<OperationView | null>>;
    readonly guard: Pick<CloseGuard, "unsavedFiles">;
    latestOpen: number;
    loadFiles(): Promise<readonly FileEntry[] | null>;
  };

function clearStop(target: StopTarget): void {
  target.latestOpen += 1;
  dropClaims(target);
  target.opened.value = [];
  target.choices.value = [];
  target.taken.value = new Map();
  target.notices.value = [];
  target.active.value = null;
  target.problem.value = null;
  target.screen.value = { kind: "files" };
}

export async function nextStop(target: StopTarget, end: StopEnd): Promise<void> {
  const dropped = target.guard.unsavedFiles();
  const before = target.operation.value?.kind ?? null;
  log.info("stop.next", { end: end.kind, operation: before ?? "none", dropped: dropped.length });
  clearStop(target);
  if (end.kind === "outside" && dropped.length > 0) {
    target.notices.value = [{ kind: "movedOn", operation: before, files: dropped }];
  }
  const listed = await target.loadFiles();
  if (end.kind === "continued" && listed !== null && listed.length === 0) {
    const stopped: Problem = {
      action: "stopped",
      operation: target.operation.value?.kind ?? null,
      message: end.message,
    };
    logProblem(stopped);
    target.problem.value = stopped;
  }
}

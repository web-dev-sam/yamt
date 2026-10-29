import type { ShallowRef } from "vue";

import { log, type FileEntry, type OperationView } from "../ipc";
import type { Asking } from "./asking";
import type { CloseGuard } from "./closeGuard";
import type { Notice } from "./noticeText";
import { report } from "./problem";
import { endsWithStop } from "./question";
import { dropStop, type FormatOutcomes, type Writing } from "./saving";
import type { Screen } from "./screen";
import type { Searching } from "./searching";
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
    readonly formatOutcomes: FormatOutcomes;
    readonly operation: Readonly<ShallowRef<OperationView | null>>;
    readonly stopMessage: ShallowRef<string | null>;
    readonly asking: Pick<Asking, "question" | "dismiss">;
    readonly guard: Pick<CloseGuard, "unsavedFiles">;
    readonly search: Pick<Searching<string>, "clear" | "rerun">;
    latestOpen: number;
    loadFiles(): Promise<readonly FileEntry[] | null>;
  };

function clearStop(target: StopTarget): void {
  target.latestOpen += 1;
  dropStop(target);
  const question = target.asking.question.value;
  if (question !== null && endsWithStop(question)) {
    target.asking.dismiss();
  }
  target.opened.value = [];
  target.choices.value = [];
  target.taken.value = new Map();
  target.notices.value = [];
  target.formatOutcomes.value = new Map();
  target.active.value = null;
  target.problem.value = null;
  target.stopMessage.value = null;
  target.screen.value = { kind: "files" };
  target.search.clear();
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
  if (listed !== null) {
    target.search.rerun();
  }
  if (end.kind === "continued" && listed !== null && listed.length === 0) {
    target.stopMessage.value = end.message;
    report(target, {
      action: "stopped",
      operation: target.operation.value?.kind ?? null,
      message: end.message,
    });
  }
}

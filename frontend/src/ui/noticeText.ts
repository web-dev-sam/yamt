import type { DiskResult, OperationKind } from "../ipc";
import { operationName } from "./operationText";

export type Notice =
  | {
      readonly kind: "disk";
      readonly path: string;
      readonly result: DiskResult;
      readonly editsDropped: boolean;
      readonly when: "start" | "running";
    }
  | {
      readonly kind: "movedOn";
      readonly operation: OperationKind | null;
      readonly files: readonly string[];
    };

export type DiskNotice = Extract<Notice, { kind: "disk" }>;

type NoticeRow = { readonly key: string; readonly text: string; readonly closeLabel: string };

function opening({ path, editsDropped, when }: DiskNotice): string {
  switch (when) {
    case "start":
      return `${path} differs on disk from git's merge`;
    case "running":
      return editsDropped
        ? `${path} changed on disk; your edits in yamt were dropped`
        : `${path} changed on disk`;
    default: {
      const _exhaustive: never = when;
      return _exhaustive;
    }
  }
}

function outcome(result: DiskResult): string {
  switch (result.kind) {
    case "Staged":
      return "staged as resolved";
    case "MarkersLeft":
      return result.conflicts === 1 ? "1 conflict left" : `${result.conflicts} conflicts left`;
    case "LeftAsIs":
      return "left unstaged";
    case "StageFailed":
      return `staging failed: ${result.message.trim()}`;
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

export function noticeKey(notice: Notice): string {
  return notice.kind === "disk" ? `disk:${notice.path}` : "movedOn";
}

export function noticeRow(notice: Notice): NoticeRow {
  const key = noticeKey(notice);
  switch (notice.kind) {
    case "disk":
      return {
        key,
        text: `${opening(notice)} — ${outcome(notice.result)}`,
        closeLabel: `Close the notice about ${notice.path}`,
      };
    case "movedOn": {
      const who = notice.operation === null ? "Git" : `The ${operationName(notice.operation)}`;
      return {
        key,
        text: `${who} moved on outside yamt; your unsaved edits in ${notice.files.join(", ")} were dropped`,
        closeLabel: "Close the notice about the dropped edits",
      };
    }
    default: {
      const _exhaustive: never = notice;
      return _exhaustive;
    }
  }
}

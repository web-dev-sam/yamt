import type { DiskResult } from "../ipc";

export type Notice = {
  readonly path: string;
  readonly result: DiskResult;
  readonly editsDropped: boolean;
  readonly when: "start" | "running";
};

function opening({ path, editsDropped, when }: Notice): string {
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

export function noticeText(notice: Notice): string {
  return `${opening(notice)} — ${outcome(notice.result)}`;
}

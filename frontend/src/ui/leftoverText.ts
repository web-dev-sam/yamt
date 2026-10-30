import type { Leftover, ReturnTo } from "../ipc";

export function returnPlaceText(to: ReturnTo): string {
  switch (to.kind) {
    case "branch":
      return to.name;
    case "commit":
      return `commit ${to.id}`;
    default: {
      const _exhaustive: never = to;
      return _exhaustive;
    }
  }
}

export function leftoverText(leftover: Leftover): string {
  switch (leftover.kind) {
    case "notReturned":
      return `HEAD moved after the merge started, so yamt did not check out ${returnPlaceText(leftover.to)} again.`;
    case "returnRefused":
      return `git did not check out ${returnPlaceText(leftover.to)} again: ${leftover.message}`;
    case "branchKept":
      return `${leftover.branch} changed after the merge started, so yamt left it as it is.`;
    case "branchCheckedOut":
      return `${leftover.branch} is still checked out, so yamt did not delete it.`;
    case "branchRefused":
      return `git did not put ${leftover.branch} back: ${leftover.message}`;
    default: {
      const _exhaustive: never = leftover;
      return _exhaustive;
    }
  }
}

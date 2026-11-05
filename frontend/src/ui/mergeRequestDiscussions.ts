import { computed, watch } from "vue";

import type {
  DiscussionDetails,
  MergeRequestIid,
  MergeRequestRow,
  MergeRequestSource,
} from "../ipc";
import {
  asked,
  becameFull,
  becameLazy,
  createQueue,
  dropped,
  leftView,
  queuedLast,
  reload,
  retried,
  rowsReloaded,
  type Queue,
} from "./mergeRequestDiscussionQueue";
import { boxClosed, threadRead, type Discussions } from "./mergeRequestDiscussionRows";

export type {
  DiscussionFailure,
  DiscussionLoad,
  Discussions,
  Reload,
} from "./mergeRequestDiscussionRows";
export { useRowDiscussions } from "./mergeRequestDiscussionRows";
export type DiscussionQueue = Discussions & {
  /** Rows the list now shows: with "full", queues each with `openDiscussions > 0` and no entry. */
  listed(rows: readonly MergeRequestRow[]): void;
  /** A refresh replaced the rows: every entry, the queue and any answer in flight dropped; then `listed(rows)`. */
  replaced(rows: readonly MergeRequestRow[]): void;
  /** D1: reads `iid` again alone, first in the queue; the entry stays as it is until the answer. The row is marked
   *  at once; `askFirst` (a button press) runs before the read, and a row already marked asks nothing. Under "off"
   *  only a row with an entry (the person view's) is read again. */
  reloadDiscussions(iid: MergeRequestIid, askFirst?: () => Promise<void>): void;
  /** F1 (owner 2026-11-05): each iid without an entry gets `loading` and is queued last, whatever the setting; an iid in
   *  `unhovered` (a running call's, after a switch to "lazy") leaves `unhovered` instead of being asked again. */
  wantRows(iids: readonly MergeRequestIid[]): void;
  /** F2's Retry, first in the queue: a `refused`/`failed` entry becomes `loading`; a read entry whose reload failed is
   *  reloaded (entry kept). Any other iid: nothing. */
  retryRows(iids: readonly MergeRequestIid[]): void;
  /** C4: every iid marked at once (a read entry `reloads` running, no entry or a failed one `loading`), then `askFirst`,
   *  then all queued first in the given order; only in the generation it started in; an iid already reloading: nothing. */
  reloadRows(iids: readonly MergeRequestIid[], askFirst: () => Promise<void>): void;
  /** The person view left: unless the setting is "full", every queued iid not in the running call and not reloading loses
   *  its `loading` entry and leaves the queue (no call after Back); read entries stay. So does a `loading` entry a pending
   *  ask holds, and the running call's iids its answer lacks. */
  viewLeft(): void;
};

function listed(queue: Queue, rows: readonly MergeRequestRow[]): void {
  if (queue.mode() === "full") {
    queuedLast(
      queue,
      rows.filter((row) => row.openDiscussions > 0).map((row) => row.iid),
    );
  }
}

function switched(queue: Queue, mode: DiscussionDetails, rows: readonly MergeRequestRow[]): void {
  switch (mode) {
    case "full":
      becameFull(queue);
      listed(queue, rows);
      return;
    case "lazy":
      becameLazy(queue);
      return;
    case "off":
      dropped(queue);
      return;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function discussionsOf(queue: DiscussionQueue): Discussions {
  const { discussions, discussionDetails, reloads } = queue;
  return {
    discussions,
    discussionDetails,
    reloads,
    askDiscussions: (iid) => {
      queue.askDiscussions(iid);
    },
    threadRead: (iid, discussion, resolved) => {
      queue.threadRead(iid, discussion, resolved);
    },
    boxClosed: (iid) => {
      queue.boxClosed(iid);
    },
  };
}

function membersOf(queue: Queue): Discussions & Pick<DiscussionQueue, "reloadDiscussions"> {
  return {
    discussions: queue.entries,
    discussionDetails: computed(queue.mode),
    reloads: queue.reloads,
    askDiscussions: (iid) => {
      asked(queue, iid);
    },
    reloadDiscussions: (iid, askFirst) => {
      reload(queue, iid, askFirst);
    },
    threadRead: (iid, discussion, resolved) => {
      threadRead(queue.entries, iid, discussion, resolved);
    },
    boxClosed: (iid) => {
      boxClosed(queue.entries, iid, queue.counted);
    },
  };
}

function personViewsOf(
  queue: Queue,
): Pick<DiscussionQueue, "wantRows" | "retryRows" | "reloadRows" | "viewLeft"> {
  return {
    wantRows: (iids) => {
      queuedLast(queue, iids);
    },
    retryRows: (iids) => {
      retried(queue, iids);
    },
    reloadRows: (iids, askFirst) => {
      rowsReloaded(queue, iids, askFirst);
    },
    viewLeft: () => {
      if (queue.mode() !== "full") {
        leftView(queue);
      }
    },
  };
}

export function createDiscussions(deps: {
  readonly source: MergeRequestSource;
  readonly mode: () => DiscussionDetails;
  readonly rows: () => readonly MergeRequestRow[];
  /** The row's open-discussions count as a reload or a box close found it (D2, C10). */
  readonly counted: (iid: MergeRequestIid, count: number) => void;
}): DiscussionQueue {
  const queue = createQueue(deps);
  watch(deps.mode, (mode) => {
    switched(queue, mode, deps.rows());
  });
  return {
    ...membersOf(queue),
    listed: (rows) => {
      listed(queue, rows);
    },
    replaced: (rows) => {
      dropped(queue);
      listed(queue, rows);
    },
    ...personViewsOf(queue),
  };
}

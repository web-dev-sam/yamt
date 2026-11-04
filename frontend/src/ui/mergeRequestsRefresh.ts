import { log, type DiscussionDetails, type MergeRequestIid, type MergeRequestSource } from "../ipc";
import type { DiscussionQueue } from "./mergeRequestDiscussions";
import { loadList, type ListState } from "./mergeRequestsList";
import type { ThreadLoad, Threads } from "./mergeRequestThread";
import { attempt } from "./problem";

export type Refreshes = {
  /** The page's Refresh and its Retry: loading at once, `askGitLabAgain`, then the list. */
  refresh(): Promise<void>;
  /** The discussions box's reload button: the row reloading at once, `askGitLabAgain`, then the row and the shown
   *  thread read again. With discussions "off" only the shown thread: refreshing at once, the ask, then its read. */
  refreshDiscussions(iid: MergeRequestIid): void;
};

/** The thread is being read (shown or read again): its reload button asks nothing. */
export function isBeingRead(load: ThreadLoad): boolean {
  return load.kind === "loading" || (load.kind === "read" && load.refreshing);
}

async function askAgain(source: MergeRequestSource): Promise<void> {
  const outcome = await attempt(() => source.askGitLabAgain());
  if (!outcome.ok) {
    log.info("mergeRequests.ask_again_failed", { kind: outcome.cause.kind });
  }
}

/** Owner decision 2423, plan §2 row 187. `show` and a submit's reload do not ask again: no button was pressed. */
export function createRefreshes(
  state: ListState & {
    readonly discussionDetails: () => DiscussionDetails;
    readonly discussionQueue: Pick<DiscussionQueue, "reloadDiscussions">;
    readonly threads: Pick<Threads, "thread">;
    readonly threadsRefreshed: (iid: MergeRequestIid, asked?: Promise<void>) => void;
  },
): Refreshes {
  return {
    refresh: () => loadList(state, () => askAgain(state.source)),
    refreshDiscussions: (iid) => {
      if (state.discussionDetails() !== "off") {
        state.discussionQueue.reloadDiscussions(iid, async () => {
          await askAgain(state.source);
          state.threadsRefreshed(iid);
        });
        return;
      }
      const shown = state.threads.thread.value;
      if (shown?.shown.iid === iid && !isBeingRead(shown.load)) {
        state.threadsRefreshed(iid, askAgain(state.source));
      }
    },
  };
}

import { log, type MergeRequestIid, type MergeRequestSource } from "../ipc";
import type { DiscussionQueue } from "./mergeRequestDiscussions";
import { loadList, type ListState } from "./mergeRequestsList";
import { attempt } from "./problem";

export type Refreshes = {
  /** The page's Refresh and its Retry: loading at once, `askGitLabAgain`, then the list. */
  refresh(): Promise<void>;
  /** The discussions box's reload button: the row reloading at once, `askGitLabAgain`, then the row and the shown
   *  thread read again. */
  refreshDiscussions(iid: MergeRequestIid): void;
};

async function askAgain(source: MergeRequestSource): Promise<void> {
  const outcome = await attempt(() => source.askGitLabAgain());
  if (!outcome.ok) {
    log.info("mergeRequests.ask_again_failed", { kind: outcome.cause.kind });
  }
}

/** Owner decision 2423, plan §2 row 187. `show` and a submit's reload do not ask again: no button was pressed. */
export function createRefreshes(
  state: ListState & {
    readonly discussionQueue: Pick<DiscussionQueue, "reloadDiscussions">;
    readonly threadsRefreshed: (iid: MergeRequestIid) => void;
  },
): Refreshes {
  return {
    refresh: () => loadList(state, () => askAgain(state.source)),
    refreshDiscussions: (iid) => {
      state.discussionQueue.reloadDiscussions(iid, async () => {
        await askAgain(state.source);
        state.threadsRefreshed(iid);
      });
    },
  };
}

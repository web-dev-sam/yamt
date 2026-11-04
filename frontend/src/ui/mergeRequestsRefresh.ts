import { log, type MergeRequestIid, type MergeRequestSource } from "../ipc";
import type { Discussions } from "./mergeRequestDiscussionRows";
import { loadList, type ListState } from "./mergeRequestsList";
import { attempt } from "./problem";

export type Refreshes = {
  /** The page's Refresh and its Retry: `askGitLabAgain`, then the list. */
  refresh(): Promise<void>;
  /** The discussions box's reload button: `askGitLabAgain`, then `reloadDiscussions(iid)`. */
  refreshDiscussions(iid: MergeRequestIid): void;
};

async function askAgain(source: MergeRequestSource): Promise<void> {
  const outcome = await attempt(() => source.askGitLabAgain());
  if (!outcome.ok) {
    log.info("mergeRequests.ask_again_failed", { kind: outcome.cause.kind });
  }
}

/** Every explicit refresh button asks GitLab for the login and the project again first (owner decision 2423, plan §2
 *  row 187); a failed ask is logged and the reload runs anyway. Loads no button starts never ask again. */
export function createRefreshes(
  state: ListState & { readonly rowDiscussions: Pick<Discussions, "reloadDiscussions"> },
): Refreshes {
  return {
    refresh: async () => {
      await askAgain(state.source);
      await loadList(state);
    },
    refreshDiscussions: (iid) => {
      void askAgain(state.source).then(() => {
        state.rowDiscussions.reloadDiscussions(iid);
      });
    },
  };
}

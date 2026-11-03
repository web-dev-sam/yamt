import type { ShallowRef } from "vue";

import type { DiscussionDetails, MergeRequestSource } from "../ipc";
import { createMergeRequests, type MergeRequests } from "./mergeRequests";
import { report, type Problem } from "./problem";
import type { Screen } from "./screen";

type WindowRefs = {
  readonly screen: ShallowRef<Screen>;
  readonly problem: ShallowRef<Problem | null>;
  readonly settings: Readonly<ShallowRef<{ readonly discussionDetails: DiscussionDetails }>>;
};

let registered: MergeRequests | null = null;

export function registerMergeRequests(slice: MergeRequests): void {
  registered = slice;
}

export function useMergeRequests(): MergeRequests {
  if (registered === null) {
    throw new Error("useMergeRequests() called before registerMergeRequests()");
  }
  return registered;
}

export function windowMergeRequests(source: MergeRequestSource, refs: WindowRefs): MergeRequests {
  const slice = createMergeRequests({
    source,
    screen: refs.screen,
    report: (problem) => {
      report(refs, problem);
    },
    discussionDetails: () => refs.settings.value.discussionDetails,
  });
  registerMergeRequests(slice);
  return slice;
}

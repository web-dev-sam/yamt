import { toValue, watch, type MaybeRefOrGetter } from "vue";

import type { GoToRequest, Searching } from "./searching";

type SearchGoTo<P extends string> = Pick<GoToRequest<P>, "pane" | "match">;

export function useSearchGoTo<P extends string>(
  search: Pick<Searching<P>, "goTo" | "took">,
  shown: MaybeRefOrGetter<boolean>,
  path: MaybeRefOrGetter<string>,
  goTo: (target: SearchGoTo<P>) => void,
): void {
  watch(
    [search.goTo, () => toValue(shown), () => toValue(path)],
    ([request, viewShown, viewPath]) => {
      if (request !== null && viewShown && request.path === viewPath) {
        goTo({ pane: request.pane, match: request.match });
        search.took(request.id);
      }
    },
    { immediate: true, flush: "post" },
  );
}

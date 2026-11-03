import type { StorageLike } from "@vueuse/core";
import { computed, type ComputedRef, type Ref } from "vue";

import type { MergeRequestRow } from "../ipc";
import { filtered, searched, summaryText, type Filters } from "../mergeRequests";
import type { DueDates } from "./mergeRequestDueDates";
import {
  choicesOf,
  createRememberedFilters,
  filterActions,
  type Choices,
  type FilterActions,
} from "./mergeRequestFilters";

export type Shown = FilterActions & {
  readonly filters: Readonly<Ref<Filters>>;
  readonly shownRows: ComputedRef<readonly MergeRequestRow[]>;
  readonly choices: ComputedRef<Choices>;
  readonly summary: ComputedRef<string>;
};

type Listed = {
  readonly repository: Readonly<Ref<string | null>>;
  readonly me: Readonly<Ref<string | null>>;
  readonly rows: Readonly<Ref<readonly MergeRequestRow[]>>;
  readonly cut: Readonly<Ref<boolean>>;
  readonly search: Readonly<Ref<string>>;
  readonly dueDates: DueDates;
};

export function shownOf(listed: Listed, storage?: StorageLike): Shown {
  const { me, rows, search } = listed;
  const remembered = createRememberedFilters(listed.repository, storage);
  const { filters } = remembered;
  const shownRows = computed(() => {
    const passing = filtered(rows.value, filters.value, me.value);
    return listed.dueDates.datedFirst(searched(passing, search.value));
  });
  return {
    filters,
    shownRows,
    choices: computed(() => choicesOf(rows.value, filters.value, me.value)),
    summary: computed(() =>
      summaryText(shownRows.value.length, rows.value.length, listed.cut.value),
    ),
    ...filterActions(remembered),
  };
}

import type { StorageLike } from "@vueuse/core";
import { computed, type Ref } from "vue";

import type { MergeRequestRow } from "../ipc";
import {
  cleared,
  clicked,
  filtersFrom,
  isFiltered,
  labelChoices,
  NO_FILTERS,
  personChoices,
  storedFilters,
  withDraft,
  type Choice,
  type DraftFilter,
  type Filters,
  type LabelValue,
  type ListFilter,
  type PersonValue,
} from "../mergeRequests";
import { storedRecord } from "./windowStorage";

const STORAGE_KEY = "yamt.mergeRequests.filters";

export type Choices = Readonly<{
  assignee: readonly Choice<PersonValue>[];
  reviewer: readonly Choice<PersonValue>[];
  label: readonly Choice<LabelValue>[];
}>;

export type FilterActions = {
  click(filter: ListFilter, value: PersonValue | LabelValue, shift: boolean): void;
  setDraft(draft: DraftFilter): void;
  clear(filter: ListFilter): void;
  clearAll(): void;
};

type RememberedFilters = { readonly filters: Readonly<Ref<Filters>>; set(next: Filters): void };

export function createRememberedFilters(
  repository: Readonly<Ref<string | null>>,
  storage?: StorageLike,
): RememberedFilters {
  const byRepository = storedRecord(STORAGE_KEY, "mergeRequests.filters_storage_failed", storage);
  const filters = computed((): Filters => {
    const at = repository.value;
    return at === null ? NO_FILTERS : filtersFrom(byRepository.entryAt(at));
  });
  return {
    filters,
    set: (next) => {
      const at = repository.value;
      if (at === null) {
        return;
      }
      if (isFiltered(next)) {
        byRepository.set(at, storedFilters(next));
      } else {
        byRepository.remove(at);
      }
    },
  };
}

export function filterActions(remembered: RememberedFilters): FilterActions {
  const { filters } = remembered;
  return {
    click: (filter, value, shift) => {
      remembered.set(clicked(filters.value, filter, value, shift));
    },
    setDraft: (draft) => {
      remembered.set(withDraft(filters.value, draft));
    },
    clear: (filter) => {
      remembered.set(cleared(filters.value, filter));
    },
    clearAll: () => {
      remembered.set(NO_FILTERS);
    },
  };
}

export function choicesOf(
  rows: readonly MergeRequestRow[],
  filters: Filters,
  me: string | null,
): Choices {
  return {
    assignee: personChoices(rows, "assignees", me, filters.assignee),
    reviewer: personChoices(rows, "reviewers", me, filters.reviewer),
    label: labelChoices(rows, filters.label),
  };
}

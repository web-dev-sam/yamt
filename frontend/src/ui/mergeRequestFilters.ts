import type { StorageLike } from "@vueuse/core";
import { computed, type Ref } from "vue";

import { filtersFrom, isFiltered, NO_FILTERS, storedFilters, type Filters } from "../mergeRequests";
import { storedRecord } from "./windowStorage";

const STORAGE_KEY = "yamt.mergeRequests.filters";

export function createRememberedFilters(
  repository: Readonly<Ref<string | null>>,
  storage?: StorageLike,
): { readonly filters: Readonly<Ref<Filters>>; set(next: Filters): void } {
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

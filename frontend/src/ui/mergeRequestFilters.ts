import type { StorageLike } from "@vueuse/core";
import { computed, type Ref } from "vue";

import { filtersFrom, isFiltered, NO_FILTERS, storedFilters, type Filters } from "../mergeRequests";
import { parseStored, storedValue } from "./windowStorage";

type FiltersByRepository = Readonly<Record<string, unknown>>;

const STORAGE_KEY = "yamt.mergeRequests.filters";

function readByRepository(raw: string): FiltersByRepository {
  const stored = parseStored(raw);
  return typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? { ...stored }
    : {};
}

export function createRememberedFilters(
  repository: Readonly<Ref<string | null>>,
  storage?: StorageLike,
): { readonly filters: Readonly<Ref<Filters>>; set(next: Filters): void } {
  const byRepository = storedValue<FiltersByRepository>(
    STORAGE_KEY,
    {},
    { read: readByRepository, write: (value) => JSON.stringify(value) },
    "mergeRequests.filters_storage_failed",
    storage,
  );
  const filters = computed((): Filters => {
    const at = repository.value;
    return at === null ? NO_FILTERS : filtersFrom(byRepository.value[at]);
  });
  return {
    filters,
    set: (next) => {
      const at = repository.value;
      if (at === null) {
        return;
      }
      const others = Object.fromEntries(
        Object.entries(byRepository.value).filter(([other]) => other !== at),
      );
      byRepository.value = isFiltered(next) ? { ...others, [at]: storedFilters(next) } : others;
    },
  };
}

<script setup lang="ts">
import { useEventListener, useIntervalFn, useNow } from "@vueuse/core";
import { computed, onMounted, useTemplateRef } from "vue";
import ArrowLeft from "~icons/lucide/arrow-left";
import RefreshCw from "~icons/lucide/refresh-cw";
import X from "~icons/lucide/x";

import { filterLabel, isFiltered, type ListFilter } from "../mergeRequests";
import { RETRY } from "./aiText";
import ChoiceButtons from "./ChoiceButtons.vue";
import { returnFocus } from "./focusReturn";
import MergeRequestFilter from "./MergeRequestFilter.vue";
import MergeRequestRow from "./MergeRequestRow.vue";
import { useMergeRequests } from "./mergeRequestsStore";
import {
  CLEAR_FILTERS,
  DRAFT_LABEL,
  DRAFT_OPTIONS,
  FILTERS_LABEL,
  LIST_LABEL,
  LOADING_TEXT,
  NONE_TEXT,
  PAGE_TITLE,
  REFRESH,
} from "./mergeRequestsText";
import { DISMISS_LABEL } from "./searchText";
import { BACK } from "./serverText";

const props = defineProps<{ asking: boolean }>();

const MINUTE_MS = 60_000;
const LIST_FILTERS: readonly ListFilter[] = ["assignee", "reviewer", "label"];

const requests = useMergeRequests();
const { rows, listing, failure, filters, shownRows, choices, summary, openings, pageProblem } =
  requests;
const back = useTemplateRef<HTMLButtonElement>("back");
const focusedBefore = document.activeElement;
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, MINUTE_MS) });
useEventListener(window, "keydown", escapePressed);

const loading = computed(() => listing.value.kind === "loading");
const waiting = computed(() => loading.value && rows.value.length === 0);
const empty = computed(
  () => listing.value.kind === "done" && failure.value === null && rows.value.length === 0,
);
const filtered = computed(() => isFiltered(filters.value));
const nowMs = computed(() => now.value.getTime());

onMounted(() => {
  back.value?.focus();
});

async function goBack(): Promise<void> {
  requests.close();
  await returnFocus(focusedBefore);
}

function escapePressed(event: KeyboardEvent): void {
  if (event.key === "Escape" && !event.defaultPrevented && !props.asking) {
    event.preventDefault();
    void goBack();
  }
}
</script>

<template>
  <section
    :aria-label="PAGE_TITLE"
    class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col island bg-panel"
  >
    <header class="flex shrink-0 items-center gap-3 border-b border-separator px-3 py-2">
      <button
        ref="back"
        type="button"
        class="flex items-center gap-1.5 rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="goBack"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />
        {{ BACK }}
      </button>
      <h2 class="font-semibold">{{ PAGE_TITLE }}</h2>
      <button
        type="button"
        :disabled="loading"
        class="ml-auto flex items-center gap-1.5 rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
        @click="requests.refresh"
      >
        <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" aria-hidden="true" />
        {{ REFRESH }}
      </button>
    </header>
    <div
      role="group"
      :aria-label="FILTERS_LABEL"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-separator px-3 py-2"
    >
      <MergeRequestFilter
        v-for="filter in LIST_FILTERS"
        :key="filter"
        :filter="filter"
        :label="filterLabel(filter, filters)"
        :set="filters[filter].length > 0"
        :choices="choices[filter]"
        @toggle="requests.toggle(filter, $event)"
        @clear="requests.clear(filter)"
      />
      <button
        v-if="filtered"
        type="button"
        class="rounded px-2 py-1 text-primary hover:bg-hover"
        @click="requests.clearAll"
      >
        {{ CLEAR_FILTERS }}
      </button>
      <ChoiceButtons
        role="group"
        :aria-label="DRAFT_LABEL"
        :options="DRAFT_OPTIONS"
        :pressed="filters.draft"
        class="ml-auto"
        @pick="requests.setDraft"
      />
    </div>
    <p
      v-if="pageProblem !== null"
      role="alert"
      class="flex shrink-0 items-center gap-2 border-b border-separator px-3 py-1.5 text-problem-error"
    >
      {{ pageProblem }}
      <button
        type="button"
        :aria-label="DISMISS_LABEL"
        class="ml-auto rounded p-1 text-fg hover:bg-hover"
        @click="requests.dismissPageProblem"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </p>
    <p
      v-if="failure !== null"
      role="alert"
      class="flex shrink-0 items-center gap-3 border-b border-separator px-3 py-2"
    >
      {{ failure }}
      <button
        type="button"
        :disabled="loading"
        class="shrink-0 rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted"
        @click="requests.refresh"
      >
        {{ RETRY }}
      </button>
    </p>
    <p v-if="waiting" class="px-3 py-2 text-fg-muted">{{ LOADING_TEXT }}</p>
    <p v-else-if="empty" class="px-3 py-2 text-fg-muted">{{ NONE_TEXT }}</p>
    <template v-else-if="rows.length > 0">
      <p class="shrink-0 px-3 pt-2 pb-1 text-fg-muted" aria-live="polite">{{ summary }}</p>
      <ul
        :aria-label="LIST_LABEL"
        :aria-busy="loading"
        class="min-h-0 flex-1 overflow-y-auto rounded-b-island opaque-scroller"
      >
        <MergeRequestRow
          v-for="row in shownRows"
          :key="row.iid"
          :row="row"
          :now="nowMs"
          :opening="openings.get(row.iid) ?? null"
          @open="requests.openChanges"
          @open-page="requests.openPage"
        />
      </ul>
    </template>
  </section>
</template>

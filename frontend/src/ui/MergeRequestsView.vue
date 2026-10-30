<script setup lang="ts">
import { useEventListener, useIntervalFn, useNow } from "@vueuse/core";
import { computed, nextTick, onMounted, useTemplateRef } from "vue";
import ArrowLeft from "~icons/lucide/arrow-left";
import RefreshCw from "~icons/lucide/refresh-cw";
import X from "~icons/lucide/x";

import { filterLabel, isFiltered, type DraftFilter, type ListFilter } from "../mergeRequests";
import ChoiceButtons from "./ChoiceButtons.vue";
import MergeRequestFilter from "./MergeRequestFilter.vue";
import MergeRequestRow from "./MergeRequestRow.vue";
import { useMergeRequests } from "./mergeRequestsStore";
import { listEndText, LOADING_TEXT, NONE_TEXT } from "./mergeRequestsText";
import { BACK } from "./serverText";

const props = defineProps<{ asking: boolean }>();

const MINUTE_MS = 60_000;
const LIST_FILTERS: readonly { readonly filter: ListFilter; readonly name: string }[] = [
  { filter: "assignee", name: "Assignee" },
  { filter: "reviewer", name: "Reviewer" },
  { filter: "label", name: "Label" },
];
const DRAFTS: readonly { readonly value: DraftFilter; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "drafts", label: "Drafts" },
  { value: "ready", label: "Ready" },
];

const requests = useMergeRequests();
const { rows, listing, filters, shownRows, choices, summary, openings, jobProblem } = requests;
const back = useTemplateRef<HTMLButtonElement>("back");
const focusedBefore = document.activeElement;
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, MINUTE_MS) });
useEventListener(window, "keydown", escapePressed);

const loading = computed(() => listing.value.kind === "loading");
const firstLoad = computed(
  () => listing.value.kind === "loading" && listing.value.first && rows.value.length === 0,
);
const failure = computed(() => {
  const load = listing.value;
  if (load.kind !== "done" || load.end.kind === "loaded" || load.end.kind === "cut") {
    return null;
  }
  return listEndText(load.end);
});
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
  await nextTick();
  if (
    focusedBefore instanceof HTMLElement &&
    focusedBefore.isConnected &&
    getComputedStyle(focusedBefore).visibility === "visible"
  ) {
    focusedBefore.focus();
  }
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
    aria-label="Merge requests"
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
      <h2 class="font-semibold">Merge requests</h2>
      <button
        type="button"
        :disabled="loading"
        class="ml-auto flex items-center gap-1.5 rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
        @click="requests.refresh"
      >
        <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" aria-hidden="true" />
        Refresh
      </button>
    </header>
    <div
      role="group"
      aria-label="Filters"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-separator px-3 py-2"
    >
      <MergeRequestFilter
        v-for="{ filter, name } in LIST_FILTERS"
        :key="filter"
        :filter="filter"
        :name="name"
        :label="filterLabel(filter, filters)"
        :set="filters[filter].length > 0"
        :choices="choices[filter]"
        @toggle="requests.toggle(filter, $event)"
        @clear="requests.clear(filter)"
      />
      <ChoiceButtons
        role="group"
        aria-label="Draft"
        :options="DRAFTS"
        :pressed="filters.draft"
        @pick="requests.setDraft"
      />
      <button
        v-if="filtered"
        type="button"
        class="rounded px-2 py-1 text-primary hover:bg-hover"
        @click="requests.clearAll"
      >
        Clear filters
      </button>
    </div>
    <p
      v-if="jobProblem !== null"
      role="alert"
      class="flex shrink-0 items-center gap-2 border-b border-separator px-3 py-1.5 text-problem-error"
    >
      {{ jobProblem }}
      <button
        type="button"
        aria-label="Dismiss"
        class="ml-auto rounded p-1 text-fg hover:bg-hover"
        @click="requests.dismissJobProblem"
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
        Retry
      </button>
    </p>
    <p v-if="firstLoad" class="px-3 py-2 text-fg-muted">{{ LOADING_TEXT }}</p>
    <p v-else-if="empty" class="px-3 py-2 text-fg-muted">{{ NONE_TEXT }}</p>
    <template v-else-if="rows.length > 0">
      <p class="shrink-0 px-3 pt-2 pb-1 text-fg-muted" aria-live="polite">{{ summary }}</p>
      <ul
        aria-label="Open merge requests"
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
          @open-job="requests.openJob"
        />
      </ul>
    </template>
  </section>
</template>

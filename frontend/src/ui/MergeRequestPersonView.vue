<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import ArrowLeft from "~icons/lucide/arrow-left";
import RefreshCw from "~icons/lucide/refresh-cw";

import { turnSummaryText } from "../mergeRequests";
import { RETRY } from "./aiText";
import MergeRequestPersonEntry from "./MergeRequestPersonEntry.vue";
import MergeRequestPersonPicker from "./MergeRequestPersonPicker.vue";
import type { PersonEntryShown } from "./mergeRequestPersonView";
import { useMergeRequests } from "./mergeRequestsStore";
import {
  BACK_TO_LIST,
  discussionsFailedText,
  PERSON_VIEW,
  personFailureText,
  personLoadingText,
  RELOAD_DISCUSSIONS,
} from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { isTypingTarget } from "./typingTarget";
import { useShiftTaps } from "./useShiftHeld";

defineProps<{ now: number; asking: boolean }>();

const requests = useMergeRequests();
const { personView, threads, expanded } = requests;
const back = useTemplateRef<HTMLButtonElement>("back");
const pointed = shallowRef<PersonEntryShown | null>(null);
const focused = shallowRef<PersonEntryShown | null>(null);

const status = computed(() => {
  const shown = personView.value;
  if (shown === null) {
    return "";
  }
  return shown.loading === null
    ? turnSummaryText(shown.counts, shown.person)
    : personLoadingText(shown.loading.answered, shown.loading.asked);
});
const failures = computed(() =>
  (personView.value?.failures ?? []).map(({ row, failure }) => ({
    iid: row.iid,
    text: personFailureText(row, discussionsFailedText(failure, navigator.platform)),
  })),
);

watch(useShiftTaps(), () => {
  const entry = pointed.value ?? focused.value;
  if (entry === null || isTypingTarget(document.activeElement)) {
    return;
  }
  requests.expandEntry(entry.row.iid, entry.discussion.id);
});

onMounted(() => {
  back.value?.focus();
});

function point(entry: PersonEntryShown): void {
  pointed.value = entry;
}

function unpoint(): void {
  pointed.value = null;
}

function focus(entry: PersonEntryShown): void {
  focused.value = entry;
}

function unfocus(): void {
  focused.value = null;
}
</script>

<template>
  <section
    v-if="personView !== null"
    :aria-label="PERSON_VIEW"
    class="flex min-h-0 flex-1 flex-col"
  >
    <header class="flex shrink-0 items-center gap-3 border-b border-separator px-3 py-2">
      <button
        ref="back"
        type="button"
        class="flex shrink-0 items-center gap-1.5 rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="requests.leavePersonView"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />
        {{ BACK_TO_LIST }}
      </button>
      <MergeRequestPersonPicker
        :lines="personView.people"
        :asking="asking"
        @pick="requests.pickPerson"
      />
      <p role="status" class="min-w-0 flex-1 truncate text-fg-muted">{{ status }}</p>
      <button
        v-tooltip="RELOAD_DISCUSSIONS"
        type="button"
        :aria-label="RELOAD_DISCUSSIONS"
        class="shrink-0 rounded p-1 hover:bg-hover"
        @click="requests.refreshPersonView"
      >
        <RefreshCw
          class="size-4"
          :class="{ 'animate-spin': personView.reloading }"
          aria-hidden="true"
        />
      </button>
    </header>
    <p
      v-for="failure in failures"
      :key="failure.iid"
      role="alert"
      class="flex shrink-0 items-center gap-3 border-b border-separator px-3 py-2"
    >
      <span class="min-w-0 text-problem-error">{{ failure.text }}</span>
      <button
        type="button"
        class="shrink-0 rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="requests.retryRow(failure.iid)"
      >
        {{ RETRY }}
      </button>
    </p>
    <ul
      v-if="personView.entries.length > 0"
      class="min-h-0 flex-1 overflow-y-auto rounded-b-island opaque-scroller"
    >
      <li
        v-for="entry in personView.entries"
        :key="entry.discussion.id"
        aria-keyshortcuts="Shift"
        :data-discussion-id="entry.discussion.id"
        class="border-b border-separator"
        @pointerenter="point(entry)"
        @pointerleave="unpoint"
        @focusin="focus(entry)"
        @focusout="unfocus"
      >
        <MergeRequestPersonEntry
          :entry="entry"
          :person="personView.person"
          :now="now"
          :expanded="expanded.has(entry.discussion.id)"
          :thread="threads.get(entry.discussion.id) ?? null"
        />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ExternalLink from "~icons/lucide/external-link";

import { useMergeRequests } from "./mergeRequestsStore";
import { isWritable, type Thread } from "./mergeRequestThread";
import { OPEN_ON_GITLAB, pendingText, SUBMIT_REVIEW, submitTip } from "./mergeRequestThreadText";
import { vTooltip } from "./tooltip";

const props = defineProps<{ thread: Thread }>();
const emit = defineEmits<{ focusHost: [] }>();

const { writing, submitReview, openPage } = useMergeRequests();

const read = computed(() => (props.thread.load.kind === "read" ? props.thread.load.thread : null));
const page = computed(() => read.value?.comments[0]?.page ?? null);
const submit = computed(() => {
  const pending = read.value?.pending ?? 0;
  return pending > 0 ? { tip: submitTip(pending), count: pendingText(pending) } : null;
});
const writable = computed(() => isWritable(props.thread, writing.value));

async function openThread(): Promise<void> {
  if (page.value !== null) {
    await openPage("discussion", page.value);
  }
}

function publish(): void {
  emit("focusHost");
  void submitReview(props.thread.shown.discussion);
}
</script>

<template>
  <button
    v-tooltip="OPEN_ON_GITLAB"
    type="button"
    :aria-label="OPEN_ON_GITLAB"
    :disabled="page === null"
    class="ml-auto shrink-0 rounded p-1 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted"
    @click="openThread"
  >
    <ExternalLink class="size-4" aria-hidden="true" />
  </button>
  <button
    v-if="submit !== null"
    v-tooltip="submit.tip"
    type="button"
    :disabled="!writable"
    class="flex shrink-0 items-center gap-1.5 rounded border border-control-border px-2 py-0.5 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted"
    @click="publish"
  >
    {{ SUBMIT_REVIEW }}<span class="text-fg-muted">{{ submit.count }}</span>
  </button>
</template>

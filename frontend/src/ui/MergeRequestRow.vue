<script setup lang="ts">
import { computed } from "vue";
import FileDiff from "~icons/lucide/file-diff";
import LoaderCircle from "~icons/lucide/loader-circle";
import MessageSquare from "~icons/lucide/message-square";
import ThumbsUp from "~icons/lucide/thumbs-up";

import type { JobPage, MergeRequestIid, MergeRequestRow } from "../ipc";
import { createdAgo } from "../mergeRequests";
import CiStatusBox from "./CiStatusBox.vue";
import type { Opening } from "./mergeRequests";
import { openReplyText } from "./mergeRequestsText";

const props = defineProps<{ row: MergeRequestRow; now: number; opening: Opening | null }>();
const emit = defineEmits<{ open: [iid: MergeRequestIid]; openJob: [page: JobPage] }>();

const CREATED_AT = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const mr = computed(() => `!${props.row.iid}`);
const created = computed(() => createdAgo(props.row.createdAt, props.now));
const createdTitle = computed(() => CREATED_AT.format(props.row.createdAt));
const discussionsText = computed(() => countText(props.row.openDiscussions, "open discussion"));
const approvalsText = computed(() => countText(props.row.approvals, "approval"));
const fetching = computed(() => props.opening?.kind === "fetching");
const sentence = computed(() => {
  const opening = props.opening;
  if (opening === null || opening.kind === "fetching") {
    return null;
  }
  const reply = opening.kind === "opened" ? ({ kind: "opened" } as const) : opening.reply;
  return { text: openReplyText(reply, props.row.iid), refused: opening.kind === "refused" };
});

function countText(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}
</script>

<template>
  <li class="flex flex-col gap-0.5 border-b border-separator px-3 py-2">
    <div class="flex items-center gap-3">
      <div class="flex min-w-0 flex-1 items-baseline gap-2">
        <span class="truncate" :title="row.title">{{ row.title }}</span>
        <span class="shrink-0 text-fg-muted">{{ mr }}</span>
        <span class="shrink-0 text-fg-muted" :title="createdTitle">{{ created }}</span>
      </div>
      <span
        class="flex w-12 shrink-0 items-center gap-1"
        :class="{ 'text-fg-muted': row.openDiscussions === 0 }"
        :title="discussionsText"
        :aria-label="discussionsText"
      >
        <MessageSquare class="size-4" aria-hidden="true" />
        <span aria-hidden="true">{{ row.openDiscussions }}</span>
      </span>
      <span
        class="flex w-12 shrink-0 items-center gap-1"
        :class="{ 'text-fg-muted': row.approvals === 0 }"
        :title="approvalsText"
        :aria-label="approvalsText"
      >
        <ThumbsUp class="size-4" aria-hidden="true" />
        <span aria-hidden="true">{{ row.approvals }}</span>
      </span>
      <span class="flex w-7 shrink-0 justify-center">
        <CiStatusBox
          v-if="row.pipeline !== null"
          :pipeline="row.pipeline"
          @open-job="emit('openJob', $event)"
        />
      </span>
      <button
        type="button"
        :title="`Open the changes of ${mr}`"
        :aria-label="`Open the changes of ${mr}`"
        :aria-busy="fetching"
        :disabled="fetching"
        class="shrink-0 rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
        @click="emit('open', row.iid)"
      >
        <LoaderCircle v-if="fetching" class="size-4 animate-spin" aria-hidden="true" />
        <FileDiff v-else class="size-4" aria-hidden="true" />
      </button>
    </div>
    <p
      v-if="sentence !== null"
      role="status"
      :class="sentence.refused ? 'text-problem-error' : 'text-fg-muted'"
    >
      {{ sentence.text }}
    </p>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import FileDiff from "~icons/lucide/file-diff";
import LoaderCircle from "~icons/lucide/loader-circle";
import MessageSquare from "~icons/lucide/message-square";
import ThumbsUp from "~icons/lucide/thumbs-up";

import type { MergeRequestIid, MergeRequestRow, WebPage } from "../ipc";
import { createdAgo } from "../mergeRequests";
import CiStatusBox from "./CiStatusBox.vue";
import type { Opening } from "./mergeRequests";
import {
  approvalsText,
  discussionsText,
  mergeRequestReference,
  openChangesTitle,
  openPageTitle,
  openReplyText,
  type PageKind,
} from "./mergeRequestsText";

const props = defineProps<{ row: MergeRequestRow; now: number; opening: Opening | null }>();
const emit = defineEmits<{
  open: [iid: MergeRequestIid];
  openPage: [clicked: PageKind, page: WebPage];
}>();

const CREATED_AT = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const mr = computed(() => mergeRequestReference(props.row.iid));
const created = computed(() => createdAgo(props.row.createdAt, props.now));
const createdTitle = computed(() => CREATED_AT.format(props.row.createdAt));
const discussions = computed(() => discussionsText(props.row.openDiscussions));
const approvals = computed(() => approvalsText(props.row.approvals));
const openTitle = computed(() => openChangesTitle(props.row.iid));
const pageTitle = computed(() => openPageTitle(props.row.iid, props.row.title));
const fetching = computed(() => props.opening?.kind === "fetching");
const sentence = computed(() => {
  const opening = props.opening;
  if (opening === null || opening.kind === "fetching") {
    return null;
  }
  const reply = opening.kind === "opened" ? ({ kind: "opened" } as const) : opening.reply;
  return { text: openReplyText(reply, props.row.iid), refused: opening.kind === "refused" };
});

function openPage(): void {
  if (props.row.page !== null) {
    emit("openPage", "mergeRequest", props.row.page);
  }
}
</script>

<template>
  <li
    class="flex flex-col gap-0.5 border-b border-separator px-3 py-2"
    :class="{ 'cursor-pointer hover:bg-row-hover': row.page !== null }"
    @click="openPage"
  >
    <div class="flex items-center gap-3">
      <div class="flex min-w-0 flex-1 items-baseline gap-2">
        <button
          v-if="row.page !== null"
          type="button"
          class="min-w-0 truncate rounded text-left"
          :title="pageTitle"
          :aria-label="pageTitle"
          @click.stop="openPage"
        >
          {{ row.title }}
        </button>
        <span v-else class="truncate" :title="row.title">{{ row.title }}</span>
        <span class="shrink-0 text-fg-muted">{{ mr }}</span>
        <span class="shrink-0 text-fg-muted" :title="createdTitle">{{ created }}</span>
      </div>
      <span
        class="flex w-12 shrink-0 items-center gap-1"
        :class="{ 'text-fg-muted': row.openDiscussions === 0 }"
        :title="discussions"
        :aria-label="discussions"
      >
        <MessageSquare class="size-4" aria-hidden="true" />
        <span aria-hidden="true">{{ row.openDiscussions }}</span>
      </span>
      <span
        class="flex w-12 shrink-0 items-center gap-1"
        :class="{ 'text-fg-muted': row.approvals === 0 }"
        :title="approvals"
        :aria-label="approvals"
      >
        <ThumbsUp class="size-4" aria-hidden="true" />
        <span aria-hidden="true">{{ row.approvals }}</span>
      </span>
      <span class="flex w-7 shrink-0 justify-center">
        <CiStatusBox
          v-if="row.pipeline !== null"
          :pipeline="row.pipeline"
          class="cursor-default"
          @click.stop
          @open-job="emit('openPage', 'job', $event)"
        />
      </span>
      <span class="flex shrink-0" @click.stop>
        <button
          type="button"
          :title="openTitle"
          :aria-label="openTitle"
          :aria-busy="fetching"
          :disabled="fetching"
          class="shrink-0 cursor-default rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @click="emit('open', row.iid)"
        >
          <LoaderCircle v-if="fetching" class="size-4 animate-spin" aria-hidden="true" />
          <FileDiff v-else class="size-4" aria-hidden="true" />
        </button>
      </span>
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

<script setup lang="ts">
import { computed } from "vue";
import FileDiff from "~icons/lucide/file-diff";
import GitMerge from "~icons/lucide/git-merge";
import LoaderCircle from "~icons/lucide/loader-circle";
import MessageSquare from "~icons/lucide/message-square";
import StepForward from "~icons/lucide/step-forward";
import ThumbsUp from "~icons/lucide/thumbs-up";

import type { LocalMerge, MergeRequestIid, MergeRequestRow, WebPage } from "../ipc";
import { createdAgo, rowAction, sizeText, sizeTitle } from "../mergeRequests";
import CiStatusBox from "./CiStatusBox.vue";
import type { RowActing } from "./mergeRequestActions";
import MergeRequestReadiness from "./MergeRequestReadiness.vue";
import type { Opening } from "./mergeRequests";
import {
  approvalsText,
  discussionsText,
  mergeRequestReference,
  openChangesTitle,
  openPageTitle,
  openReplyText,
  rowReplyText,
  type PageKind,
} from "./mergeRequestsText";

const props = defineProps<{
  row: MergeRequestRow;
  now: number;
  opening: Opening | null;
  localMerge: LocalMerge;
  acting: RowActing | null;
}>();
const emit = defineEmits<{
  open: [iid: MergeRequestIid];
  openPage: [clicked: PageKind, page: WebPage];
  resolve: [iid: MergeRequestIid];
  continueMerge: [iid: MergeRequestIid];
}>();

const CREATED_AT = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const mr = computed(() => mergeRequestReference(props.row.iid));
const created = computed(() => createdAgo(props.row.createdAt, props.now));
const createdTitle = computed(() => CREATED_AT.format(props.row.createdAt));
const discussions = computed(() => discussionsText(props.row.openDiscussions));
const approvals = computed(() => approvalsText(props.row.approvals));
const openTitle = computed(() => openChangesTitle());
const pageTitle = computed(() => openPageTitle(props.row.iid, props.row.title));
const fetching = computed(() => props.opening?.kind === "fetching");
const refusal = computed(() =>
  props.opening?.kind === "refused" ? openReplyText(props.opening.reply, props.row.iid) : null,
);
const size = computed(() =>
  props.row.size === null
    ? null
    : { text: sizeText(props.row.size), title: sizeTitle(props.row.size) },
);
const action = computed(() =>
  rowAction(props.row, props.localMerge, props.acting?.kind === "running"),
);
const actionHover = computed(() =>
  action.value.kind !== "none" && action.value.state.kind === "disabled"
    ? action.value.state.hover
    : null,
);
const reply = computed(() =>
  props.acting?.kind === "replied" ? rowReplyText(props.acting.reply, props.row.iid) : null,
);

function openPage(): void {
  if (props.row.page !== null) {
    emit("openPage", "mergeRequest", props.row.page);
  }
}

function act(): void {
  if (action.value.kind === "resolve") {
    emit("resolve", props.row.iid);
  } else if (action.value.kind === "continue") {
    emit("continueMerge", props.row.iid);
  }
}
</script>

<template>
  <li
    class="flex flex-col gap-0.5 border-b border-separator px-3 py-2"
    :class="{
      'cursor-pointer hover:not-has-[[data-row-control]:hover]:bg-row-hover': row.page !== null,
    }"
    @click="openPage"
  >
    <div class="flex items-center gap-3">
      <div class="flex min-w-0 flex-1 flex-col">
        <button
          v-if="row.page !== null"
          type="button"
          class="max-w-full cursor-pointer self-start truncate rounded text-left"
          :title="pageTitle"
          :aria-label="pageTitle"
          @click.stop="openPage"
        >
          {{ row.title }}
        </button>
        <span v-else class="truncate" :title="row.title">{{ row.title }}</span>
        <p class="truncate text-xs text-fg-muted">
          <span>{{ mr }}</span>
          <span class="mx-1" aria-hidden="true">·</span>
          <span :title="createdTitle">{{ created }}</span>
          <template v-if="size !== null">
            <span class="mx-1" aria-hidden="true">·</span>
            <span :title="size.title">{{ size.text }}</span>
          </template>
        </p>
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
          data-row-control
          class="cursor-default [&_button:enabled]:cursor-pointer"
          @click.stop
          @open-job="emit('openPage', 'job', $event)"
        />
      </span>
      <span class="flex w-7 shrink-0 justify-center">
        <MergeRequestReadiness :readiness="row.readiness" />
      </span>
      <span class="flex w-7 shrink-0" @click.stop>
        <span
          v-if="action.kind !== 'none'"
          data-row-control
          class="flex cursor-default"
          :title="actionHover ?? action.label"
        >
          <button
            type="button"
            :aria-label="action.label"
            :aria-busy="action.state.kind === 'running'"
            :disabled="action.state.kind !== 'enabled'"
            class="shrink-0 rounded p-1.5 hover:bg-hover enabled:cursor-pointer disabled:pointer-events-none disabled:text-fg-muted"
            @click="act"
          >
            <LoaderCircle
              v-if="action.state.kind === 'running'"
              class="size-4 animate-spin"
              aria-hidden="true"
            />
            <GitMerge v-else-if="action.kind === 'resolve'" class="size-4" aria-hidden="true" />
            <StepForward v-else class="size-4" aria-hidden="true" />
          </button>
        </span>
      </span>
      <span data-row-control class="flex shrink-0 cursor-default" @click.stop>
        <button
          type="button"
          :title="openTitle"
          :aria-label="openTitle"
          :aria-busy="fetching"
          :disabled="fetching"
          class="shrink-0 rounded p-1.5 hover:bg-hover enabled:cursor-pointer disabled:text-fg-muted disabled:hover:bg-transparent"
          @click="emit('open', row.iid)"
        >
          <LoaderCircle v-if="fetching" class="size-4 animate-spin" aria-hidden="true" />
          <FileDiff v-else class="size-4" aria-hidden="true" />
        </button>
      </span>
    </div>
    <p v-if="refusal !== null" role="status" class="text-problem-error">
      {{ refusal }}
    </p>
    <p v-if="reply !== null" role="status" :class="{ 'text-problem-error': reply.refused }">
      {{ reply.text }}
    </p>
  </li>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue";
import Check from "~icons/lucide/check";
import ExternalLink from "~icons/lucide/external-link";
import X from "~icons/lucide/x";

import type { DiscussionThread, MergeRequestIid } from "../ipc";
import { RETRY } from "./aiText";
import MergeRequestReplyField from "./MergeRequestReplyField.vue";
import { useMergeRequests } from "./mergeRequestsStore";
import type { ThreadLoad } from "./mergeRequestThread";
import MergeRequestThreadComment from "./MergeRequestThreadComment.vue";
import {
  CLOSE_THREAD,
  OPEN_ON_GITLAB,
  PENDING,
  pendingText,
  RESOLVED,
  SUBMIT_REVIEW,
  submitTip,
  THREAD_LOADING,
  threadLabel,
  threadRefusalText,
} from "./mergeRequestThreadText";
import { problemText } from "./problemText";
import { vTooltip } from "./tooltip";
import { useBesidePlacement } from "./useMenuPlacement";

type Content =
  | { readonly kind: "thread"; readonly thread: DiscussionThread }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "refusal"; readonly text: string };

const props = defineProps<{
  iid: MergeRequestIid;
  /** The merge request's author's username (null: unknown): the crown. */
  author: string | null;
  /** The box's words for the row: where it is and whose turn (the core's rule, via the box). */
  place: string;
  turn: string;
  /** The box's left and top: the panel's right edge meets the left, tops aligned (as CiStatusJobLog). */
  anchor: { readonly left: number; readonly top: number };
  /** The page's clock, as the box gets it: "3 hours ago". */
  now: number;
}>();
const emit = defineEmits<{ close: [] }>();

const { thread, retryThread, submitReview, openPage } = useMergeRequests();
const panel = useTemplateRef<HTMLDivElement>("panel");
const placement = useBesidePlacement(panel, () => props.anchor);

const shown = computed(() => (thread.value?.shown.iid === props.iid ? thread.value : null));
const content = computed(() => (shown.value === null ? null : contentOf(shown.value.load)));
const read = computed(() => (content.value?.kind === "thread" ? content.value.thread : null));
const label = computed(() => threadLabel(props.place));
const page = computed(() => read.value?.comments[0]?.page ?? null);
const submit = computed(() => {
  const pending = read.value?.pending ?? 0;
  return pending > 0 ? { tip: submitTip(pending), count: pendingText(pending) } : null;
});
const refreshing = computed(() => shown.value?.load.kind === "read" && shown.value.load.refreshing);
const writable = computed(
  () =>
    shown.value?.load.kind === "read" &&
    !shown.value.load.refreshing &&
    shown.value.sending.kind !== "sending",
);

onMounted(focusPanel);

function focusPanel(): void {
  panel.value?.focus();
}

function contentOf(load: ThreadLoad): Content {
  switch (load.kind) {
    case "loading":
      return { kind: "note", text: THREAD_LOADING };
    case "read":
      return { kind: "thread", thread: load.thread };
    case "refused":
      return { kind: "refusal", text: threadRefusalText(load.reply, navigator.platform) };
    case "failed":
      return {
        kind: "refusal",
        text: problemText(
          { action: "mergeRequests", step: "thread", cause: load.cause },
          navigator.platform,
        ),
      };
    default: {
      const _exhaustive: never = load;
      return _exhaustive;
    }
  }
}

async function openThread(): Promise<void> {
  if (page.value !== null) {
    await openPage("discussion", page.value);
  }
}

function keyPressed(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  emit("close");
}

function publish(): void {
  focusPanel();
  void submitReview();
}
</script>

<template>
  <div
    v-if="shown !== null"
    ref="panel"
    role="dialog"
    :aria-label="label"
    tabindex="-1"
    class="fixed z-10 flex h-[min(48rem,calc(100vh-2rem))] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-control-border bg-panel-inline text-fg shadow-lg outline-none"
    :style="placement"
    @keydown="keyPressed"
  >
    <header class="flex shrink-0 items-center gap-2 border-b border-separator px-3 py-2">
      <span class="min-w-0 truncate font-semibold">{{ place }}</span>
      <span v-if="read?.resolved" class="flex shrink-0 items-center gap-1 text-fg-muted">
        <Check class="size-4" aria-hidden="true" />{{ RESOLVED }}
      </span>
      <span v-else class="shrink-0 text-fg-muted">{{ turn }}</span>
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
      <button
        v-tooltip="CLOSE_THREAD"
        type="button"
        :aria-label="CLOSE_THREAD"
        class="shrink-0 cursor-pointer rounded p-1 hover:bg-hover"
        @click="emit('close')"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </header>
    <div
      class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3 py-2"
      :aria-busy="refreshing"
    >
      <template v-if="content?.kind === 'thread'">
        <MergeRequestThreadComment
          v-for="(comment, index) in content.thread.comments"
          :key="index"
          :comment="comment"
          :author="author"
          :now="now"
        />
        <article
          v-for="(draft, index) in content.thread.drafts"
          :key="`draft-${index}`"
          class="flex flex-col gap-1"
        >
          <span class="w-max rounded border border-control-border px-1.5 text-fg-muted">{{
            PENDING
          }}</span>
          <p class="[overflow-wrap:anywhere] whitespace-pre-wrap">{{ draft.text }}</p>
        </article>
      </template>
      <p v-else-if="content?.kind === 'note'" class="text-fg-muted">{{ content.text }}</p>
      <p v-else role="alert" class="flex items-center gap-3">
        <span class="text-problem-error">{{ content?.text }}</span>
        <button
          type="button"
          class="shrink-0 cursor-pointer rounded border border-control-border px-3.5 py-1 hover:bg-hover"
          @click="retryThread"
        >
          {{ RETRY }}
        </button>
      </p>
    </div>
    <MergeRequestReplyField
      :thread="shown"
      :writable="writable"
      @close="emit('close')"
      @focus-panel="focusPanel"
    />
  </div>
</template>

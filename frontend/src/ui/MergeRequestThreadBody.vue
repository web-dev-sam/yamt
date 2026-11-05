<script setup lang="ts">
import { computed } from "vue";

import type { DiscussionThread } from "../ipc";
import { RETRY } from "./aiText";
import MergeRequestReplyField from "./MergeRequestReplyField.vue";
import { useMergeRequests } from "./mergeRequestsStore";
import { isWritable, type Thread, type ThreadLoad } from "./mergeRequestThread";
import MergeRequestThreadComment from "./MergeRequestThreadComment.vue";
import { PENDING, THREAD_LOADING, threadRefusalText } from "./mergeRequestThreadText";
import { problemText } from "./problemText";

type Content =
  | { readonly kind: "thread"; readonly thread: DiscussionThread }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "refusal"; readonly text: string };

const props = defineProps<{
  thread: Thread;
  /** The merge request's author's username (null: unknown): the crown. */
  author: string | null;
  now: number;
  /** "beside": the comments scroll and the field sits at the bottom (the panel); "inline": natural height (an entry). */
  placement: "beside" | "inline";
}>();
const emit = defineEmits<{ cancel: []; focusHost: [] }>();

const PLACED: Readonly<Record<"beside" | "inline", string>> = {
  beside: "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3 py-2",
  inline: "flex flex-col gap-4 px-3 py-2",
};

const { writing, retryThread } = useMergeRequests();

const content = computed(() => contentOf(props.thread.load));
const refreshing = computed(
  () => props.thread.load.kind === "read" && props.thread.load.refreshing,
);
const writable = computed(() => isWritable(props.thread, writing.value));

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

function retry(): void {
  emit("focusHost");
  retryThread(props.thread.shown.discussion);
}
</script>

<template>
  <div :class="PLACED[placement]" :aria-busy="refreshing">
    <template v-if="content.kind === 'thread'">
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
    <p v-else-if="content.kind === 'note'" class="text-fg-muted">{{ content.text }}</p>
    <p v-else role="alert" class="flex items-center gap-3">
      <span class="text-problem-error">{{ content.text }}</span>
      <button
        type="button"
        class="shrink-0 cursor-pointer rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="retry"
      >
        {{ RETRY }}
      </button>
    </p>
  </div>
  <MergeRequestReplyField
    :thread="thread"
    :writable="writable"
    @cancel="emit('cancel')"
    @focus-host="emit('focusHost')"
  />
</template>

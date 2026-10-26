<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import Copy from "~icons/lucide/copy";

import type { Message } from "../ipc";
import RangePostEditor from "./RangePostEditor.vue";
import { useRangeStore } from "./rangeStore";
import { isQueued } from "./rangeThreads";
import { AI_ANSWER_TEXT, postingLabel } from "./rangeThreadText";

const props = defineProps<{ message: Message }>();

const COPY = "Copy";
const COPY_TITLE = "Copy the link to the merge request's changes";

const linkText = useTemplateRef<HTMLSpanElement>("linkText");
const { gitlab, threads } = useRangeStore();
const editing = shallowRef(false);

const noteText = computed((): string | null => {
  const { body } = props.message;
  switch (body.kind) {
    case "note":
      return body.text;
    case "aiAnswer":
      return null;
    default: {
      const _exhaustive: never = body;
      return _exhaustive;
    }
  }
});
const queued = computed(() => isQueued(props.message.posting));
const post = computed(() => gitlab.postButton(props.message));
const label = computed(() => postingLabel(props.message.posting));
const refused = computed(() => props.message.posting.kind === "refused");
const link = computed(() =>
  props.message.posting.kind === "pending" ? props.message.posting.link : null,
);

watch(queued, (now) => {
  if (now) {
    editing.value = false;
  }
});

function pressPost(): void {
  if (queued.value) {
    void threads.unqueue(props.message.id);
  } else if (noteText.value !== null) {
    editing.value = true;
  }
}

function queue(text: string): void {
  void threads.queue(props.message.id, text);
}

function copy(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    if (linkText.value !== null) {
      window.getSelection()?.selectAllChildren(linkText.value);
    }
  });
}
</script>

<template>
  <li class="flex flex-col gap-1 py-2">
    <RangePostEditor
      v-if="editing && noteText !== null"
      :text="noteText"
      @queue="queue"
      @cancel="editing = false"
    />
    <p v-else-if="noteText !== null" class="wrap-break-word whitespace-pre-wrap">
      {{ noteText }}
    </p>
    <p v-else class="text-fg-muted italic">{{ AI_ANSWER_TEXT }}</p>
    <div class="flex min-w-0 items-center gap-2 text-fg-muted">
      <span v-if="!editing" :title="post.title" class="shrink-0">
        <button
          type="button"
          :disabled="post.disabled"
          :title="post.title"
          class="rounded border border-control-border px-2 py-0.5 text-fg hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @click="pressPost"
        >
          {{ post.label }}
        </button>
      </span>
      <span
        v-if="label !== null"
        class="min-w-0 wrap-break-word"
        :class="{ 'text-problem-warning': refused }"
      >
        {{ label }}
      </span>
    </div>
    <div v-if="link !== null" class="flex min-w-0 items-center gap-2">
      <span ref="linkText" class="min-w-0 font-mono break-all select-text">{{ link }}</span>
      <button
        type="button"
        :title="COPY_TITLE"
        :aria-label="COPY_TITLE"
        class="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover"
        @click="copy(link)"
      >
        <Copy class="size-3.5" aria-hidden="true" />
        {{ COPY }}
      </button>
    </div>
  </li>
</template>

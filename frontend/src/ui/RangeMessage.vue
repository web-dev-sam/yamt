<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from "vue";
import Copy from "~icons/lucide/copy";

import type { Message } from "../ipc";
import { copyOrSelect } from "./copyOrSelect";
import RangePostEditor from "./RangePostEditor.vue";
import { useRangeStore } from "./rangeStore";
import { AI_ANSWER_TEXT, COPY_LINK_TITLE, postingLabel } from "./rangeThreadText";
import { COPIED, COPY } from "./serverText";

const props = defineProps<{ message: Message }>();

const linkText = useTemplateRef<HTMLSpanElement>("linkText");
const postButton = useTemplateRef<HTMLButtonElement>("postButton");
const { gitlab, threads } = useRangeStore();
const copied = shallowRef(false);

const bodyText = computed((): string | null => {
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
const editing = computed(
  () => bodyText.value !== null && threads.postDraft(props.message.id) !== null,
);
const post = computed(() => gitlab.postButton(props.message));
const label = computed(() => postingLabel(props.message.posting));
const refused = computed(() => props.message.posting.kind === "refused");
const link = computed(() =>
  props.message.posting.kind === "pending" ? props.message.posting.link : null,
);

function pressPost(): void {
  const { action } = post.value;
  switch (action) {
    case "edit":
      if (bodyText.value !== null) {
        threads.writePost(props.message.id, bodyText.value);
      }
      return;
    case "unqueue":
      void threads.unqueue(props.message.id);
      return;
    case null:
      return;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

async function focusPost(): Promise<void> {
  await nextTick();
  postButton.value?.focus({ preventScroll: true });
}

async function queue(text: string): Promise<void> {
  await threads.queue(props.message.id, text);
  if (!editing.value) {
    await focusPost();
  }
}

function cancel(): void {
  threads.dropPost(props.message.id);
  void focusPost();
}

async function copy(text: string): Promise<void> {
  copied.value = await copyOrSelect(text, linkText.value);
}
</script>

<template>
  <li class="flex flex-col gap-1 py-2">
    <RangePostEditor v-if="editing" :message="message.id" @queue="queue" @cancel="cancel" />
    <p v-else-if="bodyText !== null" class="wrap-break-word whitespace-pre-wrap">
      {{ bodyText }}
    </p>
    <p v-else class="text-fg-muted italic">{{ AI_ANSWER_TEXT }}</p>
    <div class="flex min-w-0 items-center gap-2 text-fg-muted">
      <span v-if="!editing" :title="post.title" class="shrink-0">
        <button
          ref="postButton"
          type="button"
          :disabled="post.action === null"
          class="rounded border border-control-border px-2 py-0.5 text-fg hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted"
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
        :title="COPY_LINK_TITLE"
        :aria-label="COPY_LINK_TITLE"
        class="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover"
        @click="copy(link)"
      >
        <Copy class="size-3.5" aria-hidden="true" />
        {{ copied ? COPIED : COPY }}
      </button>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from "vue";
import ChevronUp from "~icons/lucide/chevron-up";

import type { RangeEntry } from "../ipc";
import { isBlank } from "./rangeDrafts";
import { boxKeydown } from "./rangeKeys";
import RangeMessage from "./RangeMessage.vue";
import { useRangeStore } from "./rangeStore";
import { threadPlaceText } from "./rangeThreadText";

const props = defineProps<{ threadKey: string; file: RangeEntry }>();

const COMMENT = "Comment";
const CANCEL = "Cancel";
const COLLAPSE = "Collapse the thread";
const PROMPTS = {
  draft: { text: "Write a comment…", rows: 3 },
  reply: { text: "Reply…", rows: 1 },
};

const field = useTemplateRef<HTMLTextAreaElement>("field");
const { threads } = useRangeStore();

const box = computed(() => threads.boxOf(props.threadKey));
const draft = computed(() => (box.value?.kind === "draft" ? box.value.draft : null));
const thread = computed(() =>
  box.value?.kind === "thread" && box.value.open ? box.value.thread : null,
);
const place = computed(() => {
  const line = draft.value?.line ?? thread.value?.line;
  return line === undefined ? "" : threadPlaceText(props.file, line);
});
const text = computed(() => {
  if (draft.value !== null) {
    return draft.value.text;
  }
  return thread.value === null ? "" : threads.noteText(thread.value.id);
});
const blank = computed(() => isBlank(text.value));
const prompt = computed(() => (draft.value !== null ? PROMPTS.draft : PROMPTS.reply));

watch(
  () => draft.value?.focus,
  () => {
    focusField();
  },
);

onMounted(() => {
  if (draft.value !== null) {
    focusField();
  }
});

function focusField(): void {
  field.value?.focus({ preventScroll: true });
}

function write(next: string): void {
  if (draft.value !== null) {
    threads.writeDraft(props.threadKey, next);
  } else if (thread.value !== null) {
    threads.writeNote(thread.value.id, next);
  }
}

function typed(event: Event): void {
  if (event.target instanceof HTMLTextAreaElement) {
    write(event.target.value);
  }
}

function submit(): void {
  if (blank.value) {
    return;
  }
  if (draft.value !== null) {
    void threads.addThread(props.threadKey, text.value);
  } else if (thread.value !== null) {
    void threads.addNote(thread.value.id, text.value);
  }
}

function cancel(): void {
  if (draft.value !== null) {
    threads.dropDraft(props.threadKey);
  } else {
    write("");
  }
}

function keydown(event: KeyboardEvent): void {
  boxKeydown(event, navigator.platform, { submit, cancel });
}

function collapse(): void {
  threads.toggle([props.threadKey]);
}
</script>

<template>
  <section
    v-if="draft !== null || thread !== null"
    :aria-label="place"
    class="mx-2 my-1.5 flex flex-col gap-1 rounded-md border border-control-border bg-panel-inline px-3 py-2"
  >
    <header class="flex min-w-0 items-center gap-2 text-fg-muted">
      <span class="min-w-0 flex-1 truncate font-mono">{{ place }}</span>
      <button
        v-if="thread !== null"
        type="button"
        :title="COLLAPSE"
        :aria-label="COLLAPSE"
        class="shrink-0 rounded p-0.5 hover:bg-hover"
        @click="collapse"
      >
        <ChevronUp class="size-4" aria-hidden="true" />
      </button>
    </header>
    <ul v-if="thread !== null" class="flex flex-col divide-y divide-separator">
      <RangeMessage v-for="message in thread.messages" :key="message.id" :message="message" />
    </ul>
    <textarea
      ref="field"
      :value="text"
      :placeholder="prompt.text"
      :aria-label="prompt.text"
      :rows="prompt.rows"
      class="w-full resize-y rounded border border-control-border bg-panel px-2 py-1 outline-none focus:border-primary"
      @input="typed"
      @keydown="keydown"
    />
    <div v-if="draft !== null || !blank" class="flex gap-2">
      <button
        type="button"
        :disabled="blank"
        class="rounded border border-primary bg-primary px-3 py-0.5 text-on-primary hover:brightness-110 disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted disabled:hover:brightness-100"
        @click="submit"
      >
        {{ COMMENT }}
      </button>
      <button
        type="button"
        class="rounded border border-control-border px-3 py-0.5 hover:bg-hover"
        @click="cancel"
      >
        {{ CANCEL }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from "vue";
import ChevronUp from "~icons/lucide/chevron-up";

import type { RangeEntry } from "../ipc";
import AiTurn from "./AiTurn.vue";
import type { AskFrom } from "./rangeAi";
import { answering, liveTurn } from "./rangeAiView";
import { isBlank } from "./rangeDrafts";
import { boxKeydown } from "./rangeKeys";
import RangeMessage from "./RangeMessage.vue";
import { useRangeStore } from "./rangeStore";
import {
  ASK_AI_LABEL,
  ASK_AI_TITLE,
  ASK_AI_WAITING,
  CANCEL_LABEL,
  COLLAPSE_THREAD,
  COMMENT_LABEL,
  DRAFT_PROMPT,
  REPLY_PROMPT,
  STOP_AI_LABEL,
  STOP_AI_TITLE,
  threadPlaceText,
} from "./rangeThreadText";

const props = defineProps<{ threadKey: string; file: RangeEntry }>();

const PROMPTS = {
  draft: { text: DRAFT_PROMPT, rows: 3 },
  reply: { text: REPLY_PROMPT, rows: 1 },
};

const field = useTemplateRef<HTMLTextAreaElement>("field");
const { threads, ai } = useRangeStore();

const box = computed(() => threads.boxOf(props.threadKey));
const draft = computed(() => (box.value?.kind === "draft" ? box.value.draft : null));
const thread = computed(() =>
  box.value?.kind === "thread" && box.value.open ? box.value.thread : null,
);
const place = computed(() => {
  const shown = draft.value?.place ?? thread.value?.place;
  return shown === undefined ? "" : threadPlaceText(props.file, shown);
});
const text = computed(() => {
  if (draft.value !== null) {
    return draft.value.text;
  }
  return thread.value === null ? "" : threads.noteText(thread.value.id);
});
const blank = computed(() => isBlank(text.value));
const prompt = computed(() => (draft.value !== null ? PROMPTS.draft : PROMPTS.reply));
const threadAi = computed(() =>
  ai === null || thread.value === null ? null : ai.of(thread.value.id),
);
const live = computed(() => (threadAi.value === null ? null : liveTurn(threadAi.value)));
const stoppable = computed(() => threadAi.value !== null && answering(threadAi.value));
const askFrom = computed((): AskFrom | null => {
  if (draft.value !== null) {
    return { kind: "draft", key: props.threadKey };
  }
  return thread.value === null ? null : { kind: "thread", thread: thread.value.id };
});
const askable = computed(
  () => ai !== null && askFrom.value !== null && ai.canAsk(askFrom.value, text.value),
);
const showsActions = computed(() => ai !== null || draft.value !== null || !blank.value);

watch(
  () => draft.value?.focus,
  () => {
    focusField();
  },
);
watch(() => [thread.value?.id, thread.value?.session], loadConversation, { immediate: true });

onMounted(() => {
  if (draft.value !== null) {
    focusField();
  }
});

function focusField(): void {
  field.value?.focus({ preventScroll: true });
}

function loadConversation(): void {
  if (thread.value !== null) {
    ai?.load(thread.value.id);
  }
}

function askAi(): void {
  if (askFrom.value !== null) {
    void ai?.ask(askFrom.value, text.value);
  }
}

function stopAi(): void {
  if (thread.value !== null) {
    ai?.stop(thread.value.id);
  }
}

function retryAi(): void {
  if (thread.value !== null) {
    ai?.retry(thread.value.id);
  }
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
        :title="COLLAPSE_THREAD"
        :aria-label="COLLAPSE_THREAD"
        class="shrink-0 rounded p-0.5 hover:bg-hover"
        @click="collapse"
      >
        <ChevronUp class="size-4" aria-hidden="true" />
      </button>
    </header>
    <ul v-if="thread !== null" class="flex flex-col divide-y divide-separator">
      <RangeMessage
        v-for="message in thread.messages"
        :key="message.id"
        :message="message"
        :thread="thread.id"
      />
    </ul>
    <AiTurn
      v-if="live !== null && ai !== null"
      class="border-t border-separator pt-2"
      :turn="live.turn"
      :end="live.end"
      :client="ai.client"
      @retry="retryAi"
    />
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
    <div v-if="showsActions" class="flex gap-2">
      <button
        type="button"
        :disabled="blank"
        class="rounded border border-primary bg-primary px-3 py-0.5 text-on-primary hover:brightness-110 disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted disabled:hover:brightness-100"
        @mousedown.prevent
        @click="submit"
      >
        {{ COMMENT_LABEL }}
      </button>
      <button
        v-if="stoppable"
        type="button"
        :title="STOP_AI_TITLE"
        class="rounded border border-control-border px-3 py-0.5 hover:bg-hover"
        @mousedown.prevent
        @click="stopAi"
      >
        {{ STOP_AI_LABEL }}
      </button>
      <span v-else-if="ai !== null" :title="askable ? ASK_AI_TITLE : ASK_AI_WAITING">
        <button
          type="button"
          :disabled="!askable"
          class="rounded border border-control-border px-3 py-0.5 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted"
          @mousedown.prevent
          @click="askAi"
        >
          {{ ASK_AI_LABEL }}
        </button>
      </span>
      <button
        type="button"
        class="rounded border border-control-border px-3 py-0.5 hover:bg-hover"
        @click="cancel"
      >
        {{ CANCEL_LABEL }}
      </button>
    </div>
  </section>
</template>

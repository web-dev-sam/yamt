<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue";

import type { MessageId } from "../ipc";
import { isBlank } from "./rangeDrafts";
import { boxKeydown } from "./rangeKeys";
import { useRangeStore } from "./rangeStore";
import { CANCEL_LABEL, POST_FIELD_LABEL, QUEUE_LABEL } from "./rangeThreadText";

const props = defineProps<{ message: MessageId }>();
const emit = defineEmits<{ queue: [text: string]; cancel: [] }>();

const field = useTemplateRef<HTMLTextAreaElement>("field");
const { threads } = useRangeStore();

const text = computed(() => threads.postDraft(props.message) ?? "");
const blank = computed(() => isBlank(text.value));

onMounted(() => {
  field.value?.focus({ preventScroll: true });
});

function typed(event: Event): void {
  if (event.target instanceof HTMLTextAreaElement) {
    threads.writePost(props.message, event.target.value);
  }
}

function queue(): void {
  if (!blank.value) {
    emit("queue", text.value);
  }
}

function keydown(event: KeyboardEvent): void {
  boxKeydown(event, navigator.platform, { submit: queue, cancel: () => emit("cancel") });
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <textarea
      ref="field"
      :value="text"
      :aria-label="POST_FIELD_LABEL"
      rows="4"
      class="w-full resize-y rounded border border-control-border bg-panel-inline px-2 py-1 outline-none focus:border-primary"
      @input="typed"
      @keydown="keydown"
    />
    <div class="flex gap-2">
      <button
        type="button"
        :disabled="blank"
        class="rounded border border-primary bg-primary px-3 py-0.5 text-on-primary hover:brightness-110 disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted disabled:hover:brightness-100"
        @click="queue"
      >
        {{ QUEUE_LABEL }}
      </button>
      <button
        type="button"
        class="rounded border border-control-border px-3 py-0.5 hover:bg-hover"
        @click="emit('cancel')"
      >
        {{ CANCEL_LABEL }}
      </button>
    </div>
  </div>
</template>

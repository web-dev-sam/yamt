<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue";

import type { MessageId } from "../ipc";
import { isBlank } from "./rangeDrafts";
import { boxKeydown } from "./rangeKeys";
import { useRangeStore } from "./rangeStore";
import {
  CANCEL_LABEL,
  EDIT_FIELD_LABEL,
  POST_FIELD_LABEL,
  QUEUE_LABEL,
  SAVE_LABEL,
} from "./rangeThreadText";

type MessageBox = "post" | "edit";

const props = defineProps<{ message: MessageId; box: MessageBox; offTitle: string | null }>();
const emit = defineEmits<{ submit: [text: string]; cancel: [] }>();

const WORDS: Readonly<Record<MessageBox, { readonly field: string; readonly submit: string }>> = {
  post: { field: POST_FIELD_LABEL, submit: QUEUE_LABEL },
  edit: { field: EDIT_FIELD_LABEL, submit: SAVE_LABEL },
};

const field = useTemplateRef<HTMLTextAreaElement>("field");
const { threads } = useRangeStore();

const text = computed(
  () =>
    (props.box === "post" ? threads.postDraft(props.message) : threads.editDraft(props.message)) ??
    "",
);
const off = computed(() => props.offTitle !== null || isBlank(text.value));
const words = computed(() => WORDS[props.box]);

onMounted(() => {
  field.value?.focus({ preventScroll: true });
});

function typed(event: Event): void {
  if (!(event.target instanceof HTMLTextAreaElement)) {
    return;
  }
  if (props.box === "post") {
    threads.writePost(props.message, event.target.value);
  } else {
    threads.writeEdit(props.message, event.target.value);
  }
}

function submit(): void {
  if (!off.value) {
    emit("submit", text.value);
  }
}

function keydown(event: KeyboardEvent): void {
  boxKeydown(event, navigator.platform, { submit, cancel: () => emit("cancel") });
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <textarea
      ref="field"
      :value="text"
      :aria-label="words.field"
      rows="4"
      class="w-full resize-y rounded border border-control-border bg-panel-inline px-2 py-1 outline-none focus:border-primary"
      @input="typed"
      @keydown="keydown"
    />
    <div class="flex gap-2">
      <span :title="offTitle ?? undefined">
        <button
          type="button"
          :disabled="off"
          class="rounded border border-primary bg-primary px-3 py-0.5 text-on-primary hover:brightness-110 disabled:pointer-events-none disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted"
          @mousedown.prevent
          @click="submit"
        >
          {{ words.submit }}
        </button>
      </span>
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

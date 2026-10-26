<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef } from "vue";

import { isBlank } from "./rangeDrafts";
import { boxKeydown } from "./rangeKeys";

const props = defineProps<{ text: string }>();
const emit = defineEmits<{ queue: [text: string]; cancel: [] }>();

const QUEUE = "Queue";
const CANCEL = "Cancel";
const FIELD_LABEL = "Text to post";

const field = useTemplateRef<HTMLTextAreaElement>("field");
const edited = shallowRef(props.text);

const blank = computed(() => isBlank(edited.value));

onMounted(() => {
  field.value?.focus({ preventScroll: true });
});

function typed(event: Event): void {
  if (event.target instanceof HTMLTextAreaElement) {
    edited.value = event.target.value;
  }
}

function queue(): void {
  if (!blank.value) {
    emit("queue", edited.value);
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
      :value="edited"
      :aria-label="FIELD_LABEL"
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
        {{ QUEUE }}
      </button>
      <button
        type="button"
        class="rounded border border-control-border px-3 py-0.5 hover:bg-hover"
        @click="emit('cancel')"
      >
        {{ CANCEL }}
      </button>
    </div>
  </div>
</template>

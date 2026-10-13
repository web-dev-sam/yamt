<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue";

import { questionText, type Question } from "./question";

const props = defineProps<{ question: Question }>();
const emit = defineEmits<{ answer: [yes: boolean] }>();

const dialog = useTemplateRef<HTMLDialogElement>("dialog");

const text = computed(() => questionText(props.question, navigator.platform));

onMounted(() => {
  dialog.value?.showModal();
});

function cancel(event: Event): void {
  event.preventDefault();
  emit("answer", false);
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="question-title"
    class="m-auto w-[30rem] rounded-lg border border-control-border bg-panel p-5 text-fg"
    @cancel="cancel"
  >
    <h2 id="question-title" class="mb-3 font-semibold">{{ text.title }}</h2>
    <p>{{ text.message }}</p>
    <ul v-if="text.files.length > 0" class="mt-2 max-h-40 overflow-y-auto bg-panel font-mono">
      <li v-for="file in text.files" :key="file" class="truncate">{{ file }}</li>
    </ul>
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        autofocus
        class="rounded border border-primary bg-primary px-3.5 py-1 text-on-primary hover:brightness-110"
        @click="emit('answer', true)"
      >
        {{ text.confirm }}
      </button>
      <button
        type="button"
        class="rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="emit('answer', false)"
      >
        {{ text.cancel }}
      </button>
    </div>
  </dialog>
</template>

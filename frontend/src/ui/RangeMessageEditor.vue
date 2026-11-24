<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue";

import type { MessageId } from "../ipc";
import { knownMentions } from "../mergeRequests";
import { boxKeydown } from "./boxKeys";
import MergeRequestMentionList from "./MergeRequestMentionList.vue";
import { useMentions } from "./mergeRequestMentions";
import { linedUpRow, type ButtonView } from "./rangeGitLab";
import { useRangeStore } from "./rangeStore";
import { CANCEL_LABEL, EDIT_FIELD_LABEL, POST_FIELD_LABEL } from "./rangeThreadText";

type MessageBox = "post" | "edit";

const props = defineProps<{
  message: MessageId;
  box: MessageBox;
  text: string;
  button: ButtonView;
}>();
const emit = defineEmits<{ submit: [text: string, sendNow: boolean]; cancel: [] }>();

const FIELD_LABELS: Readonly<Record<MessageBox, string>> = {
  post: POST_FIELD_LABEL,
  edit: EDIT_FIELD_LABEL,
};

const field = useTemplateRef<HTMLTextAreaElement>("field");
const { threads, gitlab, mergeRequests } = useRangeStore();
const mentions =
  props.box === "post"
    ? useMentions(field, () =>
        knownMentions(linedUpRow(gitlab.check.value, mergeRequests.rows.value), []),
      )
    : null;

const fieldAria = computed(() => mentions?.fieldAria.value ?? {});

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

function submit(sendNow: boolean): void {
  mentions?.close();
  if (!props.button.disabled) {
    emit("submit", props.text, sendNow);
  }
}

function press(event: MouseEvent): void {
  submit(event.shiftKey);
}

function keydown(event: KeyboardEvent): void {
  if (mentions?.keydown(event) === true) {
    return;
  }
  boxKeydown(event, navigator.platform, {
    submit: () => submit(false),
    cancel: () => emit("cancel"),
  });
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="relative">
      <textarea
        ref="field"
        :value="text"
        v-bind="fieldAria"
        :aria-label="FIELD_LABELS[box]"
        rows="4"
        class="block w-full resize-y rounded border border-control-border bg-panel-inline px-2 py-1 outline-none focus:border-primary"
        @input="typed"
        @keydown="keydown"
      />
      <MergeRequestMentionList
        v-if="mentions !== null && mentions.list.value !== null && mentions.anchor.value !== null"
        :list="mentions.list.value"
        :highlight="mentions.highlight.value"
        :list-id="mentions.listId"
        :anchor="mentions.anchor.value"
        @pick="mentions.pick"
      />
    </div>
    <div class="flex gap-2">
      <span :title="button.title">
        <button
          type="button"
          :disabled="button.disabled"
          class="rounded border border-primary bg-primary px-3 py-0.5 text-on-primary hover:brightness-110 disabled:pointer-events-none disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted"
          @mousedown.prevent
          @click="press"
        >
          {{ button.label }}
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

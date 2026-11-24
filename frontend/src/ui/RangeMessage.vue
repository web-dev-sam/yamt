<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from "vue";
import Copy from "~icons/lucide/copy";

import type { Message, ThreadId } from "../ipc";
import AiTurn from "./AiTurn.vue";
import { copyOrSelect } from "./copyOrSelect";
import { answerText, answerView, postBody, type AnswerView } from "./rangeAiView";
import { isBlank } from "./rangeDrafts";
import type { ButtonView } from "./rangeGitLab";
import RangeMessageEditor from "./RangeMessageEditor.vue";
import { isChangeable, noteChangeBlock } from "./rangeNoteChange";
import { useRangeStore } from "./rangeStore";
import {
  COPY_LINK_TITLE,
  DELETE_LABEL,
  EDIT_LABEL,
  noteChangeTitle,
  postingLabel,
  SAVE_LABEL,
} from "./rangeThreadText";
import { COPIED, COPY } from "./serverText";
import { useShiftHeld } from "./useShiftHeld";

const props = defineProps<{ message: Message; thread: ThreadId }>();

const linkText = useTemplateRef<HTMLSpanElement>("linkText");
const postButton = useTemplateRef<HTMLButtonElement>("postButton");
const editButton = useTemplateRef<HTMLButtonElement>("editButton");
const { gitlab, threads, ai, deleteNote } = useRangeStore();
const copied = shallowRef(false);
const shift = useShiftHeld();

const threadAi = computed(() => (ai === null ? null : ai.of(props.thread)));
const answer = computed((): AnswerView | null => {
  const { body } = props.message;
  return body.kind === "aiAnswer" && threadAi.value !== null
    ? answerView(threadAi.value, body)
    : null;
});
const unshownText = computed(() =>
  answer.value?.kind === "turn" ? null : answerText(answer.value, navigator.platform),
);
const body = computed(() => postBody(props.message.body, threadAi.value));
const postText = computed(() =>
  body.value.kind === "text" ? threads.postDraft(props.message.id) : null,
);
const postOpen = computed(() => postText.value !== null);
const changeable = computed(() => isChangeable(props.message));
const editText = computed(() => (changeable.value ? threads.editDraft(props.message.id) : null));
const editOpen = computed(() => editText.value !== null);
const block = computed(() =>
  noteChangeBlock(gitlab.sending.value, threadAi.value === null ? null : threadAi.value.running),
);
const editTitle = computed(() => noteChangeTitle("edit", block.value));
const deleteTitle = computed(() => noteChangeTitle("delete", block.value));
const queueButton = computed(() => gitlab.queueButton(postText.value ?? "", shift.value));
const saveButton = computed((): ButtonView => ({
  label: SAVE_LABEL,
  title: block.value === null ? undefined : editTitle.value,
  disabled: block.value !== null || isBlank(editText.value ?? ""),
}));
const post = computed(() => gitlab.postButton(props.message, body.value));
const label = computed(() => postingLabel(props.message.posting));
const refused = computed(() => props.message.posting.kind === "refused");
const link = computed(() =>
  props.message.posting.kind === "pending" ? props.message.posting.link : null,
);

function pressPost(): void {
  const { action } = post.value;
  const shown = body.value;
  switch (action) {
    case "queue":
      if (shown.kind === "text") {
        void threads.queue(props.message.id, shown.text);
      }
      return;
    case "write":
      if (shown.kind === "text") {
        threads.writePost(props.message.id, shown.text);
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

function retry(): void {
  ai?.retry(props.thread);
}

async function focusLater(target: () => HTMLElement | null): Promise<void> {
  await nextTick();
  target()?.focus({ preventScroll: true });
}

async function queue(text: string, sendNow: boolean): Promise<void> {
  await gitlab.queuePost(props.message.id, text, sendNow);
  if (!postOpen.value) {
    await focusLater(() => postButton.value);
  }
}

function cancel(): void {
  threads.dropPost(props.message.id);
  void focusLater(() => postButton.value);
}

function startEdit(): void {
  const { body: shown } = props.message;
  if (shown.kind === "note") {
    threads.writeEdit(props.message.id, shown.text);
  }
}

async function saveEdit(text: string): Promise<void> {
  if (await threads.editNote(props.message.id, text)) {
    await focusLater(() => editButton.value);
  }
}

function cancelEdit(): void {
  threads.dropEdit(props.message.id);
  void focusLater(() => editButton.value);
}

function pressDelete(): void {
  void deleteNote(props.message.id);
}

async function copy(text: string): Promise<void> {
  copied.value = await copyOrSelect(text, linkText.value);
}
</script>

<template>
  <li class="flex flex-col gap-1 py-2">
    <RangeMessageEditor
      v-if="postText !== null"
      :message="message.id"
      box="post"
      :text="postText"
      :button="queueButton"
      @submit="queue"
      @cancel="cancel"
    />
    <RangeMessageEditor
      v-else-if="editText !== null"
      :message="message.id"
      box="edit"
      :text="editText"
      :button="saveButton"
      @submit="saveEdit"
      @cancel="cancelEdit"
    />
    <p v-else-if="message.body.kind === 'note'" class="wrap-break-word whitespace-pre-wrap">
      {{ message.body.text }}
    </p>
    <AiTurn
      v-else-if="answer?.kind === 'turn' && ai !== null"
      :turn="answer.turn"
      :end="answer.end"
      :client="ai.client"
      @retry="retry"
    />
    <p v-else class="text-fg-muted italic">{{ unshownText }}</p>
    <div class="flex min-w-0 items-center gap-2 text-fg-muted">
      <template v-if="!postOpen && !editOpen">
        <span :title="post.title" class="shrink-0">
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
        <template v-if="changeable">
          <span :title="editTitle" class="shrink-0">
            <button
              ref="editButton"
              type="button"
              :disabled="block !== null"
              class="rounded border border-control-border px-2 py-0.5 text-fg hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted"
              @click="startEdit"
            >
              {{ EDIT_LABEL }}
            </button>
          </span>
          <span :title="deleteTitle" class="shrink-0">
            <button
              type="button"
              :disabled="block !== null"
              class="rounded border border-control-border px-2 py-0.5 text-fg hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted"
              @click="pressDelete"
            >
              {{ DELETE_LABEL }}
            </button>
          </span>
        </template>
      </template>
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

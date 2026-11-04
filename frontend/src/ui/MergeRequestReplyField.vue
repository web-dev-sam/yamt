<script setup lang="ts">
import { computed, nextTick, onMounted, useTemplateRef, watch } from "vue";

import type { DescriptionBlock } from "../ipc";
import { boxKeydown } from "./boxKeys";
import MergeRequestDescriptionBlocks from "./MergeRequestDescriptionBlocks.vue";
import type { Preview } from "./mergeRequestPreview";
import { useMergeRequests } from "./mergeRequestsStore";
import type { Thread } from "./mergeRequestThread";
import {
  ADD_COMMENT,
  ADD_REVIEW,
  commentingReason,
  MAY_NOT_RESOLVE,
  NOTHING_TO_PREVIEW,
  PREVIEW,
  previewFailureText,
  REPLY_PLACEHOLDER,
  RESOLVE_THREAD,
  THREAD_LOADING,
  UNRESOLVE_THREAD,
  WRITE,
  writeFailureText,
} from "./mergeRequestThreadText";
import { vTooltip } from "./tooltip";

type Shown =
  | { readonly kind: "blocks"; readonly blocks: readonly DescriptionBlock[] }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "refusal"; readonly text: string };
type Button = { readonly disabled: boolean; readonly reason: string | null };

const props = defineProps<{ thread: Thread; writable: boolean }>();
const emit = defineEmits<{ close: []; focusPanel: [] }>();

const MIN_LINES = 3;
const MAX_LINES = 12;
const BUTTON =
  "rounded border border-control-border px-3 py-0.5 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted";

const { replyTexts, setReplyText, showPreview, showWrite, sendReply, setResolved } =
  useMergeRequests();
const field = useTemplateRef<HTMLTextAreaElement>("field");

const text = computed({
  get: () => replyTexts.value.get(props.thread.shown.discussion) ?? "",
  set: (typed: string) => {
    setReplyText(props.thread.shown.discussion, typed);
  },
});
const writing = computed(() => props.thread.preview.kind === "writing");
const shownPreview = computed(() => previewOf(props.thread.preview));
const loaded = computed(() => (props.thread.load.kind === "read" ? props.thread.load : null));
const add = computed((): Button => {
  const reason = loaded.value === null ? null : commentingReason(loaded.value.thread.commenting);
  return { disabled: !props.writable || text.value.trim() === "" || reason !== null, reason };
});
const resolve = computed((): Button & { readonly label: string; readonly to: boolean } => {
  const thread = loaded.value?.thread ?? null;
  const reason = thread === null || thread.mayResolve ? null : MAY_NOT_RESOLVE;
  const resolved = thread?.resolved ?? false;
  return {
    disabled: !props.writable || reason !== null,
    reason,
    label: resolved ? UNRESOLVE_THREAD : RESOLVE_THREAD,
    to: !resolved,
  };
});
const failure = computed(() => {
  const { sending } = props.thread;
  return sending.kind === "failed"
    ? writeFailureText(sending.what, sending.failure, navigator.platform)
    : null;
});

watch([text, writing], fit, { flush: "post" });

onMounted(fit);

function previewOf(preview: Preview): Shown | null {
  switch (preview.kind) {
    case "writing":
      return null;
    case "loading":
      return { kind: "note", text: THREAD_LOADING };
    case "empty":
      return { kind: "note", text: NOTHING_TO_PREVIEW };
    case "read":
      return preview.preview.blocks.length === 0
        ? { kind: "note", text: NOTHING_TO_PREVIEW }
        : { kind: "blocks", blocks: preview.preview.blocks };
    case "refused":
    case "failed":
      return { kind: "refusal", text: previewFailureText(preview, navigator.platform) };
    default: {
      const _exhaustive: never = preview;
      return _exhaustive;
    }
  }
}

function pixels(value: string): number {
  return Number.parseFloat(value);
}

function fit(): void {
  const element = field.value;
  if (element === null || !writing.value) {
    return;
  }
  const style = getComputedStyle(element);
  const line = pixels(style.lineHeight);
  const padding = pixels(style.paddingTop) + pixels(style.paddingBottom);
  const border = pixels(style.borderTopWidth) + pixels(style.borderBottomWidth);
  element.style.height = "auto";
  const content = Math.min(
    Math.max(element.scrollHeight - padding, MIN_LINES * line),
    MAX_LINES * line,
  );
  element.style.height = `${content + padding + border}px`;
}

async function backToWrite(): Promise<void> {
  showWrite();
  await nextTick();
  field.value?.focus();
}

/** A pressed button that turns disabled drops WebKit's focus to the body without a focusout, and Escape would then
 *  reach the page (HTML "focus fixup rule": https://html.spec.whatwg.org/multipage/interaction.html#focus-fixup-rule). */
function keepFocus(): void {
  if (writing.value) {
    field.value?.focus();
  } else {
    emit("focusPanel");
  }
}

function send(kind: "comment" | "draft"): void {
  if (!add.value.disabled) {
    keepFocus();
    void sendReply(kind);
  }
}

function keyPressed(event: KeyboardEvent): void {
  boxKeydown(event, navigator.platform, {
    submit: () => {
      send("comment");
    },
    cancel: () => {
      emit("close");
    },
  });
}

function toggleResolved(): void {
  keepFocus();
  void setResolved(resolve.value.to);
}
</script>

<template>
  <div class="flex shrink-0 flex-col gap-2 border-t border-separator px-3 py-2">
    <div class="flex gap-1">
      <button
        type="button"
        :aria-pressed="writing"
        class="rounded px-2 py-0.5 hover:bg-hover aria-pressed:bg-row-selected"
        @click="backToWrite"
      >
        {{ WRITE }}
      </button>
      <button
        type="button"
        :aria-pressed="!writing"
        class="rounded px-2 py-0.5 hover:bg-hover aria-pressed:bg-row-selected"
        @click="showPreview"
      >
        {{ PREVIEW }}
      </button>
    </div>
    <textarea
      v-show="writing"
      ref="field"
      v-model="text"
      :placeholder="REPLY_PLACEHOLDER"
      :aria-label="REPLY_PLACEHOLDER"
      class="w-full resize-none overflow-y-auto rounded border border-control-border bg-panel px-2 py-1 leading-5 outline-none focus:border-primary"
      @keydown="keyPressed"
    ></textarea>
    <div
      v-if="shownPreview !== null"
      class="max-h-60 min-h-[4.5rem] overflow-y-auto rounded border border-control-border px-2 py-1 [overflow-wrap:anywhere]"
    >
      <MergeRequestDescriptionBlocks
        v-if="shownPreview.kind === 'blocks'"
        :blocks="shownPreview.blocks"
      />
      <p v-else-if="shownPreview.kind === 'note'" class="text-fg-muted">{{ shownPreview.text }}</p>
      <p v-else role="alert" class="text-problem-error">{{ shownPreview.text }}</p>
    </div>
    <div class="flex items-center gap-2">
      <span v-tooltip="add.reason" class="flex">
        <button type="button" :disabled="add.disabled" :class="BUTTON" @click="send('draft')">
          {{ ADD_REVIEW }}
        </button>
      </span>
      <span v-tooltip="add.reason" class="flex">
        <button
          type="button"
          :disabled="add.disabled"
          class="rounded border border-primary bg-primary px-3 py-0.5 text-on-primary hover:brightness-110 disabled:pointer-events-none disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted"
          @click="send('comment')"
        >
          {{ ADD_COMMENT }}
        </button>
      </span>
      <span v-tooltip="resolve.reason" class="ml-auto flex">
        <button type="button" :disabled="resolve.disabled" :class="BUTTON" @click="toggleResolved">
          {{ resolve.label }}
        </button>
      </span>
    </div>
    <p v-if="failure !== null" role="alert" class="text-problem-error">{{ failure }}</p>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { computed, onMounted, useTemplateRef } from "vue";
import Check from "~icons/lucide/check";
import X from "~icons/lucide/x";

import type { MergeRequestIid } from "../ipc";
import { useMergeRequests } from "./mergeRequestsStore";
import MergeRequestThreadBody from "./MergeRequestThreadBody.vue";
import MergeRequestThreadButtons from "./MergeRequestThreadButtons.vue";
import { CLOSE_THREAD, RESOLVED, threadLabel } from "./mergeRequestThreadText";
import { vTooltip } from "./tooltip";
import { useBesidePlacement } from "./useMenuPlacement";

const props = defineProps<{
  iid: MergeRequestIid;
  /** The merge request's author's username (null: unknown): the crown. */
  author: string | null;
  /** The box's words for the row: where it is and whose turn (the core's rule, via the box). */
  place: string;
  turn: string;
  /** The box's left and top: the panel's right edge meets the left, tops aligned (as CiStatusJobLog). */
  anchor: { readonly left: number; readonly top: number };
  /** The page's clock, as the box gets it: "3 hours ago". */
  now: number;
  asking: boolean;
}>();
const emit = defineEmits<{ close: [] }>();

const { thread, description } = useMergeRequests();
const panel = useTemplateRef<HTMLDivElement>("panel");
const placement = useBesidePlacement(panel, () => props.anchor);
useEventListener(window, "keydown", keyPressed);

const shown = computed(() => (thread.value?.shown.iid === props.iid ? thread.value : null));
const resolved = computed(
  () => shown.value?.load.kind === "read" && shown.value.load.thread.resolved,
);
const label = computed(() => threadLabel(props.place));

onMounted(focusPanel);

function focusPanel(): void {
  panel.value?.focus();
}

function keyPressed(event: KeyboardEvent): void {
  if (
    event.key !== "Escape" ||
    event.defaultPrevented ||
    shown.value === null ||
    props.asking ||
    description.value !== null
  ) {
    return;
  }
  event.preventDefault();
  emit("close");
}
</script>

<template>
  <div
    v-if="shown !== null"
    ref="panel"
    role="dialog"
    :aria-label="label"
    tabindex="-1"
    class="fixed z-10 flex h-[min(48rem,calc(100vh-2rem))] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-control-border bg-panel-inline text-fg shadow-lg outline-none"
    :style="placement"
    @keydown="keyPressed"
  >
    <header class="flex shrink-0 items-center gap-2 border-b border-separator px-3 py-2">
      <span class="min-w-0 truncate font-semibold">{{ place }}</span>
      <span v-if="resolved" class="flex shrink-0 items-center gap-1 text-fg-muted">
        <Check class="size-4" aria-hidden="true" />{{ RESOLVED }}
      </span>
      <span v-else class="shrink-0 text-fg-muted">{{ turn }}</span>
      <MergeRequestThreadButtons :thread="shown" @focus-host="focusPanel" />
      <button
        v-tooltip="CLOSE_THREAD"
        type="button"
        :aria-label="CLOSE_THREAD"
        class="shrink-0 cursor-pointer rounded p-1 hover:bg-hover"
        @click="emit('close')"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </header>
    <MergeRequestThreadBody
      :thread="shown"
      :author="author"
      :now="now"
      placement="beside"
      @cancel="emit('close')"
      @focus-host="focusPanel"
    />
  </div>
</template>

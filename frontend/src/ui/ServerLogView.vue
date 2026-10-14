<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import ArrowLeft from "~icons/lucide/arrow-left";

import { EMPTY_LOG, logTime, logTitle, YAMT_MARK } from "./serverText";
import { useAppStore } from "./store";

defineProps<{ name: string }>();

const { shownLog, closeServerLog, question } = useAppStore();
const back = useTemplateRef<HTMLButtonElement>("back");
const scroller = useTemplateRef<HTMLDivElement>("scroller");
const following = shallowRef(true);
useEventListener(window, "keydown", escapePressed);

const lines = computed(() =>
  shownLog.value.map((line) => ({
    time: logTime(line.at),
    muted: line.source === "stderr",
    mark: line.source === "yamt" ? YAMT_MARK : null,
    text: line.text,
  })),
);

watch(shownLog, followEnd, { flush: "post" });

onMounted(async () => {
  back.value?.focus();
  await nextTick();
  scrollToEnd();
});

function scrollToEnd(): void {
  if (scroller.value !== null) {
    scroller.value.scrollTop = scroller.value.scrollHeight;
  }
}

function followEnd(): void {
  if (following.value) {
    scrollToEnd();
  }
}

function scrolled(): void {
  const element = scroller.value;
  if (element !== null) {
    following.value = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
  }
}

function escapePressed(event: KeyboardEvent): void {
  if (event.key === "Escape" && !event.defaultPrevented && question.value === null) {
    event.preventDefault();
    closeServerLog();
  }
}
</script>

<template>
  <section
    :aria-label="logTitle(name)"
    class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col rounded-island bg-panel"
  >
    <header class="flex shrink-0 items-center gap-3 border-b border-separator px-3 py-2">
      <button
        ref="back"
        type="button"
        class="flex items-center gap-1.5 rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="closeServerLog"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />
        Back
      </button>
      <h2 class="font-semibold">{{ logTitle(name) }}</h2>
    </header>
    <p v-if="lines.length === 0" class="p-3 text-fg-muted">{{ EMPTY_LOG }}</p>
    <div
      v-else
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto rounded-b-island opaque-scroller p-3 font-mono"
      @scroll="scrolled"
    >
      <p
        v-for="(line, index) in lines"
        :key="index"
        class="flex gap-3"
        :class="{ 'text-fg-muted': line.muted }"
      >
        <span class="shrink-0 text-fg-muted">{{ line.time }}</span>
        <span v-if="line.mark !== null" class="shrink-0 text-primary">{{ line.mark }}</span>
        <span class="min-w-0 wrap-break-word whitespace-pre-wrap">{{ line.text }}</span>
      </p>
    </div>
  </section>
</template>

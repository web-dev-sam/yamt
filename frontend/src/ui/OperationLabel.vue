<script setup lang="ts">
import { useElementBounding, useWindowSize } from "@vueuse/core";
import { computed, shallowRef, useTemplateRef, watch } from "vue";

import type { OperationView } from "../ipc";
import { operationLine, operationTag } from "./operationText";
import { tooltipBox } from "./operationTooltip";

const props = defineProps<{ operation: OperationView }>();

const tag = useTemplateRef<HTMLParagraphElement>("tag");
const word = useTemplateRef<HTMLSpanElement>("word");
const tagBounds = useElementBounding(tag, { windowScroll: false });
const wordBounds = useElementBounding(word, { windowScroll: false });
const viewport = useWindowSize();
const open = shallowRef(false);

const line = computed(() => operationLine(props.operation));
const placement = computed(() => {
  const box = tooltipBox({
    tagTop: tagBounds.top.value,
    textLeft: wordBounds.left.value,
    viewport: { width: viewport.width.value, height: viewport.height.value },
  });
  return {
    left: `${box.left}px`,
    bottom: `${box.bottom}px`,
    maxWidth: `${box.maxWidth}px`,
    maxHeight: `${box.maxHeight}px`,
  };
});

watch(
  () => tagBounds.width.value === 0,
  (hidden) => {
    if (hidden) {
      open.value = false;
    }
  },
);

function show(): void {
  tagBounds.update();
  wordBounds.update();
  open.value = true;
}

function hide(): void {
  open.value = false;
}
</script>

<template>
  <p
    ref="tag"
    role="status"
    aria-labelledby="operation-line"
    aria-describedby="operation-tooltip"
    class="shrink-0 truncate px-3 pt-1.5 pb-1 text-xs font-semibold text-fg-muted"
    @mouseenter="show"
    @mouseleave="hide"
  >
    <span ref="word" aria-hidden="true">{{ operationTag(operation.kind) }}</span>
    <span id="operation-line" class="sr-only">{{ line.text }}</span>
    <span id="operation-tooltip" hidden>{{ line.tooltip }}</span>
  </p>
  <div
    v-if="open"
    aria-hidden="true"
    class="pointer-events-none fixed z-500 w-max overflow-hidden hover-tooltip px-2 py-1 tooltip-text wrap-break-word whitespace-pre-wrap select-none"
    :style="placement"
    v-text="line.tooltip"
  />
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue";

import type { FileMergeData } from "../ipc";
import MergeToolbar from "./MergeToolbar.vue";
import { useMergeController } from "./useMergeController";

const props = defineProps<{ data: FileMergeData | null }>();
const emit = defineEmits<{ finish: [text: string]; reset: [] }>();

const left = useTemplateRef<HTMLDivElement>("left");
const center = useTemplateRef<HTMLDivElement>("center");
const right = useTemplateRef<HTMLDivElement>("right");
const leftStrip = useTemplateRef<SVGSVGElement>("leftStrip");
const rightStrip = useTemplateRef<SVGSVGElement>("rightStrip");
const { summary, applyAllNonConflicting, undo, redo, resultText } = useMergeController(
  () => props.data,
  { left, center, right, strips: [leftStrip, rightStrip] },
);

function finish(): void {
  const text = resultText();
  if (text !== null) {
    emit("finish", text);
  }
}
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <MergeToolbar
      :summary="summary"
      @apply-left="applyAllNonConflicting('local')"
      @apply-right="applyAllNonConflicting('remote')"
      @undo="undo"
      @redo="redo"
      @reset="emit('reset')"
      @finish="finish"
    />
    <section
      class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-editor"
    >
      <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">Local (yours)</h2>
      <div class="border-b border-separator bg-window" />
      <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">Result</h2>
      <div class="border-b border-separator bg-window" />
      <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">Remote (theirs)</h2>

      <div ref="left" class="min-h-0 min-w-0" />
      <svg ref="leftStrip" aria-hidden="true" class="h-full w-full border-x border-separator" />
      <div ref="center" class="min-h-0 min-w-0" />
      <svg ref="rightStrip" aria-hidden="true" class="h-full w-full border-x border-separator" />
      <div ref="right" class="min-h-0 min-w-0" />
    </section>
  </div>
</template>

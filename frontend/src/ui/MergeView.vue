<script setup lang="ts">
import { useTemplateRef } from "vue";

import { useMergeController, type MergeTexts } from "./useMergeController";

const props = defineProps<{ texts: MergeTexts }>();

const left = useTemplateRef<HTMLDivElement>("left");
const center = useTemplateRef<HTMLDivElement>("center");
const right = useTemplateRef<HTMLDivElement>("right");
useMergeController(() => props.texts, { left, center, right });
</script>

<template>
  <section
    class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-editor"
  >
    <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">Local (yours)</h2>
    <div class="border-b border-separator bg-window" />
    <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">Result</h2>
    <div class="border-b border-separator bg-window" />
    <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">Remote (theirs)</h2>

    <div ref="left" class="min-h-0 min-w-0" />
    <svg aria-hidden="true" class="h-full w-full border-x border-separator" />
    <div ref="center" class="min-h-0 min-w-0" />
    <svg aria-hidden="true" class="h-full w-full border-x border-separator" />
    <div ref="right" class="min-h-0 min-w-0" />
  </section>
</template>

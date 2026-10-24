<script setup lang="ts">
import { computed } from "vue";

import type { RangeChange, RangeEntry } from "../ipc";
import { changeMark, lineCounts } from "./rangeText";

const props = defineProps<{ file: RangeEntry; label: string }>();

const LETTER_COLOURS: Readonly<Record<RangeChange["kind"], string>> = {
  added: "text-success-signal",
  modified: "text-chunk-modified-removal",
  deleted: "text-problem-error",
  renamed: "text-problem-warning",
};

const mark = computed(() => changeMark(props.file.change));
const letterColour = computed(() => LETTER_COLOURS[props.file.change.kind]);
const oldPath = computed(() =>
  props.file.change.kind === "renamed" ? props.file.change.oldPath : null,
);
const counts = computed(() => lineCounts(props.file.lines));
</script>

<template>
  <span
    role="img"
    :title="mark.word"
    :aria-label="mark.word"
    class="w-3 shrink-0 text-center font-semibold"
    :class="letterColour"
  >
    {{ mark.letter }}
  </span>
  <span class="truncate">{{ label }}</span>
  <span v-if="oldPath !== null" class="min-w-0 truncate text-fg-muted">{{ oldPath }}</span>
  <span v-if="counts !== null" class="ml-auto flex shrink-0 gap-1.5 tabular-nums">
    <span class="text-success-signal">{{ counts.added }}</span>
    <span class="text-problem-error">{{ counts.removed }}</span>
  </span>
</template>

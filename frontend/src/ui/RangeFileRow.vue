<script setup lang="ts">
import { computed } from "vue";
import MessageSquare from "~icons/lucide/message-square";

import type { RangeChange, RangeEntry } from "../ipc";
import RangeCounts from "./RangeCounts.vue";
import { changeMark } from "./rangeText";
import { threadCountText } from "./rangeThreadText";

const props = defineProps<{ file: RangeEntry; label: string; threads: number }>();

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
const threadsTitle = computed(() => threadCountText(props.threads));
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
  <span
    v-if="threads > 0"
    role="img"
    :title="threadsTitle"
    :aria-label="threadsTitle"
    class="ml-auto flex shrink-0 items-center gap-0.5 text-fg-muted tabular-nums"
  >
    <MessageSquare class="size-3.5" aria-hidden="true" />
    {{ threads }}
  </span>
  <RangeCounts :lines="file.lines" :class="{ 'ml-auto': threads === 0 }" />
</template>

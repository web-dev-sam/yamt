<script setup lang="ts">
import { computed } from "vue";

import type { RangeLineCounts } from "../ipc";
import { lineCounts } from "./rangeText";

const props = defineProps<{ lines: RangeLineCounts; muted?: boolean }>();

const counts = computed(() => lineCounts(props.lines));
const tones = computed(() =>
  props.muted
    ? { added: "text-fg-muted", removed: "text-fg-muted" }
    : { added: "text-success-signal", removed: "text-problem-error" },
);
</script>

<template>
  <span v-if="counts !== null" class="flex shrink-0 gap-1.5 tabular-nums">
    <span :class="tones.added">{{ counts.added }}</span>
    <span :class="tones.removed">{{ counts.removed }}</span>
  </span>
</template>

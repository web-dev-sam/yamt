<script setup lang="ts">
import { computed } from "vue";

import type { RangeLineCounts } from "../ipc";
import { lineCounts } from "./rangeText";

const props = defineProps<{ lines: RangeLineCounts }>();

const counts = computed(() => lineCounts(props.lines));
</script>

<template>
  <span v-if="counts !== null" class="flex shrink-0 gap-1.5 tabular-nums">
    <span class="text-success-signal">{{ counts.added }}</span>
    <span class="text-problem-error">{{ counts.removed }}</span>
  </span>
</template>

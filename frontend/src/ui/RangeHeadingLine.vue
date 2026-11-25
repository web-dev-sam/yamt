<script setup lang="ts">
import { computed } from "vue";

import type { RangeLineCounts, RangeStart } from "../ipc";
import RangeCounts from "./RangeCounts.vue";
import { headingLine, RANGE_HEADING_LABEL } from "./rangeText";

const props = defineProps<{ start: RangeStart }>();

const line = computed(() => headingLine(props.start));
const totals = computed((): RangeLineCounts => ({ kind: "counted", ...props.start.totals }));
</script>

<template>
  <div
    role="group"
    :aria-label="RANGE_HEADING_LABEL"
    class="flex h-9 shrink-0 items-center gap-2 island bg-panel px-3"
  >
    <template v-if="line.kind === 'typed'">
      <code
        class="max-w-64 min-w-0 truncate rounded border border-control-border bg-panel-inline px-1.5 font-mono text-code"
        :title="line.left"
      >
        {{ line.left }}
      </code>
      <span class="shrink-0 font-mono text-fg-muted">{{ line.dots }}</span>
      <code
        class="max-w-64 min-w-0 truncate rounded border border-control-border bg-panel-inline px-1.5 font-mono text-code"
        :title="line.right"
      >
        {{ line.right }}
      </code>
    </template>
    <template v-else>
      <span class="shrink-0 text-fg-muted">{{ line.reference }}</span>
      <span
        v-if="line.kind === 'mergeRequest'"
        class="min-w-0 flex-1 truncate font-semibold"
        :title="line.title"
      >
        {{ line.title }}
      </span>
      <code
        class="max-w-64 min-w-0 truncate rounded border border-control-border bg-panel-inline px-1.5 font-mono text-code"
        :title="line.source"
      >
        {{ line.source }}
      </code>
      <span class="shrink-0 text-fg-muted">→</span>
      <code
        class="max-w-64 min-w-0 truncate rounded border border-control-border bg-panel-inline px-1.5 font-mono text-code"
        :title="line.target"
      >
        {{ line.target }}
      </code>
    </template>
    <RangeCounts :lines="totals" class="ml-auto" />
  </div>
</template>

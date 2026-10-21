<script setup lang="ts">
import { computed } from "vue";

import type { OperationView } from "../ipc";
import { operationLine, operationTag } from "./operationText";

const props = defineProps<{ operation: OperationView }>();

const line = computed(() => operationLine(props.operation));
</script>

<template>
  <p
    role="status"
    :title="line.tooltip"
    :aria-label="line.text"
    class="shrink-0 truncate px-3 pt-1.5 pb-1 text-xs font-semibold text-fg-muted"
  >
    {{ operationTag(operation.kind) }}
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { OperationView } from "../ipc";
import { operationLine } from "./operationText";

const props = defineProps<{ operation: OperationView }>();

const line = computed(() => operationLine(props.operation));
</script>

<template>
  <p
    role="status"
    :title="line.tooltip"
    class="h-8 shrink-0 truncate rounded-md border border-info-border bg-info px-3 leading-7.5 text-fg"
  >
    {{ line.text }}
  </p>
</template>

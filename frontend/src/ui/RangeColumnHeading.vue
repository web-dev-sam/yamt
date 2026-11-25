<script setup lang="ts">
import { branchedOffNote, type ColumnName } from "./rangeText";

defineProps<{ column: ColumnName }>();
</script>

<template>
  <h3 class="truncate border-b border-separator px-3 py-1.5" :title="column.subject">
    <template v-if="column.kind === 'named'">
      <span class="font-semibold text-fg">{{ `${column.name} ` }}</span>
      <span v-if="column.branchedOff !== null" class="text-fg-muted">
        {{ `${branchedOffNote(column.branchedOff)} ` }}
      </span>
    </template>
    <span class="font-mono text-fg-muted">{{ column.shortId }}</span>
  </h3>
</template>

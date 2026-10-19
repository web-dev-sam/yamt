<script setup lang="ts">
import type { Side } from "../ipc";
import ResizeDots from "./ResizeDots.vue";
import type { ColumnDragBinding } from "./useColumnDrag";

defineProps<{ side: Side; handle: ColumnDragBinding }>();

const LABEL: Readonly<Record<Side, string>> = {
  local: "Local and Result widths",
  remote: "Result and Remote widths",
};
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    :aria-label="LABEL[side]"
    class="flex cursor-col-resize items-center justify-center"
    v-on="handle.listeners"
  >
    <ResizeDots :state="handle.dots.value" />
  </div>
</template>

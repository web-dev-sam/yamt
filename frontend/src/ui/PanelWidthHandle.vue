<script setup lang="ts">
import ResizeDots from "./ResizeDots.vue";
import type { ColumnDragBinding } from "./useColumnDrag";

defineProps<{ label: string; handle: ColumnDragBinding }>();
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    class="absolute inset-y-0 panel-handle z-10 cursor-col-resize"
    v-on="handle.listeners"
  >
    <!-- Flex-centred dots in this handle make about half of the panes' scroll frames late in WebKitGTK; centred as an absolute box they do not. -->
    <ResizeDots class="absolute inset-0 m-auto size-fit" :state="handle.dots.value" />
  </div>
</template>

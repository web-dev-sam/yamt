<script setup lang="ts">
import type { DotsState } from "./useColumnDrag";

defineProps<{ state: DotsState }>();

// VS Code `Sash`: `hover` comes 300 ms after the pointer rests (`globalHoverDelay`) and goes at once.
const TONE: Readonly<Record<DotsState, string>> = {
  rest: "bg-handle delay-0",
  hover: "bg-handle-active delay-300",
  drag: "bg-handle-active delay-0",
};
</script>

<template>
  <span aria-hidden="true" class="pointer-events-none flex flex-col gap-[3px]">
    <span
      v-for="dot in 3"
      :key="dot"
      class="size-[3px] rounded-full transition-colors"
      :class="TONE[state]"
    />
  </span>
</template>

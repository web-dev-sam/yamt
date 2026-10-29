<script setup lang="ts">
import { useTemplateRef } from "vue";

import PanelWidthHandle from "./PanelWidthHandle.vue";
import { usePanelWidth } from "./usePanelWidth";

defineSlots<{ search(): unknown; default(): unknown }>();

const column = useTemplateRef<HTMLElement>("column");
const { widthStyle, resize } = usePanelWidth(column);
</script>

<template>
  <div
    ref="column"
    class="relative mr-(--island-overlap) flex w-60 shrink-0 flex-col gap-island"
    :style="widthStyle"
  >
    <slot name="search" />
    <slot />
    <PanelWidthHandle label="File list width" :handle="resize" />
  </div>
</template>

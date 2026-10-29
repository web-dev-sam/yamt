<script setup lang="ts">
import { useTemplateRef } from "vue";

import PanelWidthHandle from "./PanelWidthHandle.vue";
import { usePanelWidth } from "./usePanelWidth";

defineProps<{ searchShown: boolean; filesShown: boolean }>();
defineSlots<{ search(): unknown; default(): unknown }>();

const column = useTemplateRef<HTMLElement>("column");
const { widthStyle, resize } = usePanelWidth(column);
</script>

<template>
  <div
    v-show="searchShown || filesShown"
    ref="column"
    class="relative mr-(--island-overlap) flex w-60 shrink-0 flex-col gap-island"
    :class="{ '*:nth-2:mt-(--island-overlap)': searchShown && filesShown }"
    :style="widthStyle"
  >
    <slot name="search" />
    <slot />
    <PanelWidthHandle label="File list width" :handle="resize" />
  </div>
</template>

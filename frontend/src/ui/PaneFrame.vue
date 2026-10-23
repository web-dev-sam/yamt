<script setup lang="ts">
import { useEventListener } from "@vueuse/core";

const props = defineProps<{ shown: boolean; asking: boolean; columns: string }>();
const emit = defineEmits<{ shownKeydown: [event: KeyboardEvent] }>();

// Each strip and its border sit on their own layer: repainting them inside the window's layer on every scroll frame was slow in WebKitGTK (plan §2 #51).
const STRIP_LAYER = "min-h-0 border-x border-separator will-change-transform";

useEventListener(window, "keydown", keydownWhileShown);

function keydownWhileShown(event: KeyboardEvent): void {
  if (props.shown && !props.asking) {
    emit("shownKeydown", event);
  }
}
</script>

<template>
  <div
    class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-island"
    :class="{ 'invisible [content-visibility:hidden]': !shown }"
  >
    <slot name="header" />
    <!-- Rounded without clipping: overflow hidden around the scrolling panes was slower in WebKitGTK (plan §2 #51); the 4 px inset keeps the pane corners inside the arc. -->
    <section
      class="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] island bg-panel px-1 pb-1"
      :style="{ gridTemplateColumns: columns }"
    >
      <slot :strip-layer="STRIP_LAYER" />
    </section>
  </div>
</template>

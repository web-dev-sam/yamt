<script setup lang="ts">
import { useEventListener, useWindowFocus, useWindowSize } from "@vueuse/core";
import { computed, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import Check from "~icons/lucide/check";

import { menuPosition, type Point, type Size } from "./menuPosition";
import { useAppStore } from "./store";
import { TOOLBAR_BUTTONS, type ToolbarButtonId } from "./toolbarButtons";

type Item = { readonly id: ToolbarButtonId; readonly label: string; readonly shown: boolean };

const props = defineProps<{
  at: Point;
  buttons: Readonly<Record<ToolbarButtonId, { readonly label: string }>>;
}>();
const emit = defineEmits<{ close: [] }>();

const { hiddenButtons, toggleButton } = useAppStore();
const panel = useTemplateRef<HTMLDivElement>("panel");
const size = shallowRef<Size>({ width: 0, height: 0 });
const viewport = useWindowSize();
const windowFocused = useWindowFocus();
useEventListener(window, "keydown", keyPressed, { capture: true });
useEventListener(window, "mousedown", pressedElsewhere, { capture: true });
useEventListener(window, "pointerdown", pressedElsewhere, { capture: true });

const items = computed(() =>
  TOOLBAR_BUTTONS.map((id): Item => ({
    id,
    label: props.buttons[id].label,
    shown: !hiddenButtons.value.has(id),
  })),
);
const placement = computed(() => {
  const { x, y } = menuPosition({
    pointer: props.at,
    menu: size.value,
    viewport: { width: viewport.width.value, height: viewport.height.value },
  });
  return { left: `${x}px`, top: `${y}px` };
});

watch(windowFocused, (focused) => {
  if (!focused) {
    emit("close");
  }
});

onMounted(() => {
  if (panel.value !== null) {
    const { width, height } = panel.value.getBoundingClientRect();
    size.value = { width, height };
  }
});

function keyPressed(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    event.preventDefault();
  }
  emit("close");
}

function pressedElsewhere(event: MouseEvent): void {
  if (!(event.target instanceof Node && panel.value?.contains(event.target) === true)) {
    emit("close");
  }
}

function choose(id: ToolbarButtonId): void {
  toggleButton(id);
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="panel"
      role="menu"
      class="fixed z-10 rounded-md border border-control-border bg-panel-inline p-1 whitespace-nowrap shadow-lg"
      :style="placement"
      @mousedown.prevent
      @contextmenu.prevent
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        role="menuitemcheckbox"
        :aria-checked="item.shown"
        tabindex="-1"
        class="flex w-full items-center gap-2 rounded py-1 pr-3 pl-1.5 text-left hover:bg-hover"
        @click="choose(item.id)"
      >
        <Check v-if="item.shown" class="size-4" aria-hidden="true" />
        <span v-else class="size-4" aria-hidden="true" />
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

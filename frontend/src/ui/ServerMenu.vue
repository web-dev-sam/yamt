<script setup lang="ts">
import { useElementSize, useEventListener, useWindowFocus, useWindowSize } from "@vueuse/core";
import { computed, onMounted, shallowRef, useTemplateRef, watch } from "vue";

import { stepMenuItem } from "./menuKeys";
import { menuPosition, type Point } from "./menuPosition";
import {
  ACTION_LABELS,
  COPIED,
  COPY,
  installText,
  serverActions,
  SHOW_LOG,
  stateLine,
  type ServerAction,
} from "./serverText";
import { useAppStore } from "./store";

const props = defineProps<{ name: string; at: Point }>();
const emit = defineEmits<{ close: [] }>();

const { serverViews, startServer, stopServer, restartServer, showServerLog } = useAppStore();
const panel = useTemplateRef<HTMLDivElement>("panel");
const size = useElementSize(panel, undefined, { box: "border-box" });
const viewport = useWindowSize();
const windowFocused = useWindowFocus();
const copied = shallowRef<string | null>(null);
useEventListener(window, "keydown", keyPressed, { capture: true });
useEventListener(window, "pointerdown", pressedElsewhere, { capture: true });

const view = computed(() => serverViews.value.find((each) => each.name === props.name) ?? null);
const line = computed(() => (view.value === null ? "" : stateLine(view.value.state)));
const actions = computed(() => (view.value === null ? [] : serverActions(view.value.state)));
const hint = computed(() =>
  view.value?.state.kind === "notInstalled" ? installText(view.value.state.hint) : null,
);
const placement = computed(() => {
  const { x, y } = menuPosition({
    pointer: props.at,
    menu: { width: size.width.value, height: size.height.value },
    viewport: { width: viewport.width.value, height: viewport.height.value },
  });
  return { left: `${x}px`, top: `${y}px` };
});

watch(windowFocused, (focused) => {
  if (!focused) {
    emit("close");
  }
});
watch(view, (now) => {
  if (now === null) {
    emit("close");
  }
});

onMounted(() => {
  panel.value?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
});

function menuItems(): HTMLElement[] {
  return [...(panel.value?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
}

function keyPressed(event: KeyboardEvent): void {
  const items = menuItems();
  const step = stepMenuItem(
    { count: items.length, focused: items.findIndex((item) => item === document.activeElement) },
    event,
  );
  switch (step.kind) {
    case "close":
      event.preventDefault();
      event.stopPropagation();
      emit("close");
      return;
    case "focus":
      event.preventDefault();
      event.stopPropagation();
      items[step.index]?.focus();
      return;
    case "ignore":
      return;
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

function pressedElsewhere(event: PointerEvent): void {
  if (!(event.target instanceof Node && panel.value?.contains(event.target) === true)) {
    emit("close");
  }
}

function run(action: ServerAction): void {
  switch (action) {
    case "start":
      startServer(props.name);
      break;
    case "stop":
      stopServer(props.name);
      break;
    case "restart":
      restartServer(props.name);
      break;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
  emit("close");
}

function showLog(): void {
  showServerLog(props.name);
  emit("close");
}

async function copy(command: string, event: MouseEvent): Promise<void> {
  const box = event.currentTarget instanceof HTMLElement ? event.currentTarget.parentElement : null;
  try {
    await navigator.clipboard.writeText(command);
    copied.value = command;
  } catch {
    const code = box?.querySelector("code");
    if (code !== null && code !== undefined) {
      window.getSelection()?.selectAllChildren(code);
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="panel"
      role="menu"
      :aria-label="name"
      class="fixed z-10 w-max max-w-[30rem] rounded-md border border-control-border bg-panel-inline p-1 shadow-lg"
      :style="placement"
      @contextmenu.prevent
    >
      <div class="px-2 py-1">
        <p class="font-semibold">{{ name }}</p>
        <p class="wrap-break-word text-fg-muted">{{ line }}</p>
      </div>
      <div v-if="hint !== null" class="flex flex-col gap-2 px-2 pt-1 pb-2">
        <p class="wrap-break-word">{{ hint.reason }}</p>
        <div v-for="step in hint.steps" :key="step.label">
          <p>{{ step.label }}</p>
          <div class="mt-1 flex items-center gap-1">
            <code
              class="min-w-0 flex-1 rounded border border-control-border bg-panel px-2 py-1 font-mono break-all select-text"
              >{{ step.command }}</code
            >
            <button
              type="button"
              role="menuitem"
              tabindex="-1"
              class="shrink-0 rounded border border-control-border px-2.5 py-1 outline-none hover:bg-hover focus:bg-row-selected"
              @click="copy(step.command, $event)"
            >
              {{ copied === step.command ? COPIED : COPY }}
            </button>
          </div>
        </div>
        <p v-if="hint.managerNote !== null">{{ hint.managerNote }}</p>
        <p class="wrap-break-word">{{ hint.otherWay }}</p>
        <p class="text-fg-muted">{{ hint.comeBack }}</p>
      </div>
      <button
        v-for="action in actions"
        :key="action"
        type="button"
        role="menuitem"
        tabindex="-1"
        class="flex w-full rounded px-2 py-1 text-left outline-none hover:bg-hover focus:bg-row-selected"
        @click="run(action)"
      >
        {{ ACTION_LABELS[action] }}
      </button>
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        class="flex w-full rounded px-2 py-1 text-left outline-none hover:bg-hover focus:bg-row-selected"
        @click="showLog"
      >
        {{ SHOW_LOG }}
      </button>
    </div>
  </Teleport>
</template>

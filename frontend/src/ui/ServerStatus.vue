<script setup lang="ts">
import { computed, shallowRef } from "vue";
import CircleX from "~icons/lucide/circle-x";
import TriangleAlert from "~icons/lucide/triangle-alert";

import type { Point } from "./menuPosition";
import ServerMenu from "./ServerMenu.vue";
import { dotKind, formatNote, problemsTitle, stateLine, type DotKind } from "./serverText";
import { useAppStore } from "./store";
import type { MergeHandle } from "./useMergeController";

type OpenMenu = { readonly name: string; readonly at: Point };

const props = defineProps<{
  path: string | null;
  problems: MergeHandle["problems"]["value"];
}>();

const DOT_CLASSES: Readonly<Record<DotKind, string>> = {
  running: "bg-success-border",
  busy: "bg-fg-muted",
  stopped: "border border-fg-muted",
  problem: "bg-problem-error",
  warning: "bg-problem-warning",
};

const { serverViews, serving, formatOutcomes } = useAppStore();
const menu = shallowRef<OpenMenu | null>(null);

const buttons = computed(() =>
  serverViews.value.map((view) => ({
    name: view.name,
    title: stateLine(view.state),
    dot: DOT_CLASSES[dotKind(view.state)],
  })),
);
const counts = computed(() =>
  props.path === null || props.problems === null || !serving(props.path) ? null : props.problems,
);
const countsTitle = computed(() => (counts.value === null ? "" : problemsTitle(counts.value)));
const note = computed(() =>
  props.path === null ? null : formatNote(formatOutcomes.value.get(props.path)),
);

function openMenu(name: string, event: MouseEvent): void {
  if (event.currentTarget instanceof HTMLElement) {
    const { left, bottom } = event.currentTarget.getBoundingClientRect();
    menu.value = { name, at: { x: left, y: bottom } };
  }
}

function closeMenu(): void {
  menu.value = null;
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-1 text-fg-muted">
    <template v-if="buttons.length > 0">
      <span v-if="note !== null" role="status" class="mr-2 flex min-w-0 items-center gap-1">
        <TriangleAlert class="size-4 shrink-0 text-problem-warning" aria-hidden="true" />
        <span class="truncate" :title="note">{{ note }}</span>
      </span>
      <span
        v-if="counts !== null"
        role="status"
        :title="countsTitle"
        :aria-label="countsTitle"
        class="mr-1 flex items-center gap-1 tabular-nums"
      >
        <CircleX class="size-4 text-problem-error" aria-hidden="true" />
        {{ counts.errors }}
        <TriangleAlert class="ml-1 size-4 text-problem-warning" aria-hidden="true" />
        {{ counts.warnings }}
      </span>
      <button
        v-for="button in buttons"
        :key="button.name"
        type="button"
        :title="button.title"
        :aria-label="button.name"
        :aria-description="button.title"
        aria-haspopup="menu"
        :aria-expanded="menu?.name === button.name"
        class="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-hover"
        @click="openMenu(button.name, $event)"
      >
        <span class="size-2 shrink-0 rounded-full" :class="button.dot" aria-hidden="true" />
        {{ button.name }}
      </button>
      <ServerMenu v-if="menu !== null" :name="menu.name" :at="menu.at" @close="closeMenu" />
    </template>
  </div>
</template>

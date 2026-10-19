<script setup lang="ts">
import { computed, shallowRef } from "vue";
import CircleX from "~icons/lucide/circle-x";
import TriangleAlert from "~icons/lucide/triangle-alert";

import { serverButtons } from "./serverButtons";
import ServerGroup from "./ServerGroup.vue";
import ServerMenu from "./ServerMenu.vue";
import { menuAfterClick, type OpenMenu } from "./serverMenuToggle";
import { dotKind, formatNote, groupDot, problemsTitle } from "./serverText";
import { useAppStore } from "./store";
import { belowLeft } from "./useMenuPlacement";
import type { ProblemCounts } from "./useMergeController";

const props = defineProps<{
  path: string | null;
  problems: ProblemCounts | null;
}>();

const { serverViews, serving, formatOutcomes, pinnedServers } = useAppStore();
const menu = shallowRef<OpenMenu | null>(null);

const buttons = computed(() => serverButtons(serverViews.value, pinnedServers.value));
const pinned = computed(() => buttons.value.filter((button) => button.pinned));
const dot = computed(() => groupDot(serverViews.value.map((view) => dotKind(view.state))));
const counts = computed(() =>
  props.path === null || props.problems === null || !serving(props.path) ? null : props.problems,
);
const countsTitle = computed(() => (counts.value === null ? "" : problemsTitle(counts.value)));
const note = computed(() =>
  props.path === null ? null : formatNote(formatOutcomes.value.get(props.path)),
);

function openMenu(name: string, event: MouseEvent): void {
  if (event.currentTarget instanceof HTMLElement) {
    menu.value = menuAfterClick(menu.value, {
      name,
      at: belowLeft(event.currentTarget),
      opener: event.currentTarget,
    });
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
        v-for="button in pinned"
        :key="button.key"
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
      <ServerGroup :buttons="buttons" :dot="dot" />
      <ServerMenu
        v-if="menu !== null"
        :name="menu.name"
        :at="menu.at"
        :opener="menu.opener"
        @close="closeMenu"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import Check from "~icons/lucide/check";
import History from "~icons/lucide/history";

import type { FileEntry } from "../ipc";

type Mark = {
  readonly icon: Component;
  readonly word: string;
  readonly hint: string | null;
  readonly mutesName: boolean;
};

const props = defineProps<{ status: FileEntry["status"]; label: string }>();

const MARKS: Readonly<Record<FileEntry["status"], Mark | null>> = {
  Unresolved: null,
  Resolved: { icon: Check, word: "resolved", hint: null, mutesName: true },
  Remembered: {
    icon: History,
    word: "remembered",
    hint: "git rerere filled in a resolution you recorded before; review it, then Mark resolved",
    mutesName: false,
  },
};

const mark = computed(() => MARKS[props.status]);
const hint = computed(() => mark.value?.hint ?? undefined);
</script>

<template>
  <span class="truncate" :class="{ 'text-fg-muted': mark?.mutesName === true }">
    {{ label }}
  </span>
  <span
    v-if="mark !== null"
    :role="hint === undefined ? undefined : 'img'"
    :title="hint"
    :aria-label="hint"
    class="ml-auto flex shrink-0 items-center gap-1 text-fg-muted"
  >
    <component :is="mark.icon" class="size-3.5" aria-hidden="true" />
    {{ mark.word }}
  </span>
</template>

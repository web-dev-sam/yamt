<script setup lang="ts">
import Check from "~icons/lucide/check";
import History from "~icons/lucide/history";

import type { FileEntry } from "../ipc";

defineProps<{ status: FileEntry["status"] }>();

const REMEMBERED_HINT =
  "git rerere filled in a resolution you recorded before; review it, then Mark resolved";
</script>

<template>
  <span v-if="status === 'Resolved'" class="ml-auto flex shrink-0 items-center gap-1 text-fg-muted">
    <Check class="size-3.5" aria-hidden="true" />
    resolved
  </span>
  <span
    v-else-if="status === 'Remembered'"
    role="img"
    :title="REMEMBERED_HINT"
    :aria-label="REMEMBERED_HINT"
    class="ml-auto flex shrink-0 items-center gap-1 text-fg-muted"
  >
    <History class="size-3.5" aria-hidden="true" />
    remembered
  </span>
</template>

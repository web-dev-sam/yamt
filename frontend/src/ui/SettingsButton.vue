<script setup lang="ts">
import Settings from "~icons/lucide/settings";

import { useAppStore } from "./store";

const { openSettings } = useAppStore();
</script>

<template>
  <button
    type="button"
    title="Settings"
    aria-label="Settings"
    class="rounded p-1.5 hover:bg-hover"
    @click="openSettings"
  >
    <Settings class="size-4" aria-hidden="true" />
  </button>
</template>

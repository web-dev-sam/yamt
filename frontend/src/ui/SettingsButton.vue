<script setup lang="ts">
import Settings from "~icons/lucide/settings";

import { useSettingsStore } from "./settingsStore";

const { openSettings } = useSettingsStore();
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

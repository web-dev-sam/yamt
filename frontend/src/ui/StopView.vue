<script setup lang="ts">
import OperationButtons from "./OperationButtons.vue";
import ServerStatus from "./ServerStatus.vue";
import SettingsButton from "./SettingsButton.vue";

defineProps<{ message: string | null }>();
</script>

<template>
  <div class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-island">
    <header class="flex h-10 shrink-0 items-center justify-end px-2">
      <ServerStatus class="ml-auto" :path="null" :problems="null" />
      <SettingsButton />
    </header>
    <section class="flex min-h-0 flex-1 flex-col items-start gap-3 rounded-island bg-panel p-3">
      <p>Git stopped without conflicts.</p>
      <pre
        v-if="message !== null && message !== ''"
        class="max-w-full overflow-auto opaque-scroller font-mono whitespace-pre-wrap"
        >{{ message }}</pre>
      <OperationButtons :abort="true" />
    </section>
  </div>
</template>

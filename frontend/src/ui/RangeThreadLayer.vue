<script setup lang="ts">
import { computed } from "vue";

import type { RangeEntry } from "../ipc";
import RangeThreadBox from "./RangeThreadBox.vue";

const props = defineProps<{ file: RangeEntry; hosts: ReadonlyMap<string, HTMLElement> }>();

const placed = computed(() => [...props.hosts]);
</script>

<template>
  <Teleport v-for="[key, host] in placed" :key="key" :to="host">
    <RangeThreadBox :thread-key="key" :file="file" />
  </Teleport>
</template>

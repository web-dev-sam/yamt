<script setup lang="ts">
import FileList from "./FileList.vue";
import MergeToolbar from "./MergeToolbar.vue";
import MergeView from "./MergeView.vue";
import { SAMPLE } from "./sample";

const SAMPLE_PATHS: readonly string[] = [SAMPLE.path];
</script>

<template>
  <div class="flex h-full flex-col">
    <MergeToolbar />
    <div class="flex min-h-0 flex-1">
      <FileList :paths="SAMPLE_PATHS" :active="SAMPLE.path" />
      <MergeView :texts="SAMPLE.texts" />
    </div>
  </div>
</template>

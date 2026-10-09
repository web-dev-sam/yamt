<script setup lang="ts">
import FileList from "./FileList.vue";
import MergeToolbar from "./MergeToolbar.vue";
import MergeView from "./MergeView.vue";
import { useAppStore } from "./store";

const { files, active, data, open } = useAppStore();
</script>

<template>
  <div class="flex h-full flex-col">
    <MergeToolbar />
    <div class="flex min-h-0 flex-1">
      <FileList :files="files" :active="active" @select="open" />
      <MergeView :data="data" />
    </div>
  </div>
</template>

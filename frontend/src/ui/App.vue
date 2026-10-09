<script setup lang="ts">
import FileList from "./FileList.vue";
import MergeView from "./MergeView.vue";
import { useAppStore } from "./store";

const { files, active, data, open, finish, reset } = useAppStore();
</script>

<template>
  <div class="flex h-full">
    <FileList :files="files" :active="active" @select="open" />
    <MergeView :data="data" @finish="finish" @reset="reset" />
  </div>
</template>

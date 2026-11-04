<script setup lang="ts">
import { useTemplateRef } from "vue";

import { useMarkdownCode } from "./useMarkdown";

const props = defineProps<{ language: string | null; text: string }>();

const host = useTemplateRef<HTMLDivElement>("host");
useMarkdownCode(host, () => ({ language: props.language, text: props.text }));
</script>

<template>
  <div ref="host" class="markdown-block"></div>
</template>

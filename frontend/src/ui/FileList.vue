<script setup lang="ts">
defineProps<{ paths: readonly string[]; active: string | null }>();

function extension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toUpperCase();
}
</script>

<template>
  <aside class="flex w-60 shrink-0 flex-col border-r border-separator bg-window">
    <h2 class="px-3 py-2 font-semibold">Files</h2>
    <ul role="listbox" aria-label="Conflicted files" class="flex-1 overflow-y-auto">
      <li
        v-for="path in paths"
        :key="path"
        role="option"
        :aria-selected="path === active"
        class="mx-1 flex cursor-default items-center gap-2 rounded px-2 py-1 hover:bg-hover aria-selected:bg-row-selected"
      >
        <span class="rounded-sm bg-primary px-1 text-[9px] leading-tight font-bold text-on-primary">
          {{ extension(path) }}
        </span>
        <span class="truncate">{{ path }}</span>
      </li>
    </ul>
  </aside>
</template>

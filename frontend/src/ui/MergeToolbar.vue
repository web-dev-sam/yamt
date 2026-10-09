<script setup lang="ts">
type IconButton = { readonly label: string; readonly path: string };

const ICON_BUTTONS: readonly IconButton[] = [
  { label: "Apply non-conflicting changes from the left", path: "M3 4l4 4-4 4M9 4l4 4-4 4" },
  { label: "Apply non-conflicting changes from the right", path: "M13 4l-4 4 4 4M7 4L3 8l4 4" },
  { label: "Undo", path: "M6 4L3 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H7" },
  { label: "Redo", path: "M10 4l3 3-3 3M13 7H6.5a3.5 3.5 0 0 0 0 7H9" },
];
</script>

<template>
  <header class="flex h-10 shrink-0 items-center gap-1 border-b border-separator bg-window px-2">
    <button
      v-for="button in ICON_BUTTONS"
      :key="button.label"
      type="button"
      :title="button.label"
      :aria-label="button.label"
      class="rounded p-1.5 hover:bg-hover"
    >
      <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true">
        <path
          :d="button.path"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <div class="ml-auto flex gap-2">
      <button type="button" class="rounded border border-control-border px-3.5 py-1 hover:bg-hover">
        Reset file
      </button>
      <button
        type="button"
        class="rounded border border-primary bg-primary px-3.5 py-1 text-on-primary hover:brightness-110"
      >
        Mark resolved
      </button>
    </div>
  </header>
</template>

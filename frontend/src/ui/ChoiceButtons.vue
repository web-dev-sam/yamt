<script setup lang="ts" generic="T extends string">
defineProps<{ options: readonly { readonly value: T; readonly label: string }[]; pressed: T }>();
const emit = defineEmits<{ pick: [value: T] }>();
</script>

<template>
  <div class="flex gap-2">
    <button
      v-for="{ value, label } in options"
      :key="value"
      type="button"
      :aria-pressed="pressed === value"
      class="rounded border border-control-border px-3.5 py-1 hover:bg-hover aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-on-primary aria-pressed:hover:brightness-110"
      @click="emit('pick', value)"
    >
      {{ label }}
    </button>
  </div>
</template>

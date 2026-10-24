import { expect, test } from "vitest";

import { firstViolation } from "./check-sfc-order";

test("an SFC in section order passes", () => {
  const text = `<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
type Props = { label: string };
const props = defineProps<Props>();
const count = ref(0);
const store = useAppStore();
const doubled = computed(() => count.value * 2);
watch(count, reset);
onMounted(reset);
function reset(): void {}
</script>
<template><p>{{ props.label }} {{ doubled }} {{ store }}</p></template>
`;

  expect(firstViolation("Ok.vue", text)).toBeUndefined();
});

test("a function before computed reports the computed line", () => {
  const text = `<template><p /></template>
<script setup lang="ts">
import { computed, ref } from "vue";
const count = ref(0);
function reset(): void {}
const doubled = computed(() => count.value * 2);
</script>
`;

  expect(firstViolation("Bad.vue", text)).toBe(
    "Bad.vue:6: computed after function (order: import → type → macro → state → computed → watch → lifecycle → function)",
  );
});

test("a composable after a lifecycle hook reports", () => {
  const text = `<script setup lang="ts">
import { onUnmounted } from "vue";
onUnmounted(stop);
const store = useAppStore();
function stop(): void {}
</script>
`;

  expect(firstViolation("Late.vue", text)).toMatch(/^Late\.vue:4: state after lifecycle /);
});

test("a defineSlots after state reports the macro line", () => {
  const text = `<script setup lang="ts">
import { ref } from "vue";
const open = ref(false);
const slots = defineSlots<{ default(): unknown }>();
</script>
<template><p>{{ open }} {{ slots }}</p></template>
`;

  expect(firstViolation("Slots.vue", text)).toMatch(/^Slots\.vue:4: macro after state /);
});

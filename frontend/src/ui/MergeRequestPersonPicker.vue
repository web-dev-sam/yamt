<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";
import Check from "~icons/lucide/check";

import type { Person } from "../ipc";
import type { PersonLine, Viewer } from "../mergeRequests";
import MergeRequestMenu from "./MergeRequestMenu.vue";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { PEOPLE, PERSON_MENU } from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { useHoverMenu } from "./useHoverMenu";

const props = defineProps<{ lines: readonly PersonLine<Person>[]; asking: boolean }>();
const emit = defineEmits<{ pick: [person: Viewer] }>();

const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef("box");
const { openFor, above, pointerEntered, pointerLeft, openerClicked, menuKey, dismiss, close } =
  useHoverMenu<"person">({
    menu: (): HTMLElement | null => box.value?.menu ?? null,
    opener: () => opener.value,
  });
useEventListener(window, "keydown", escapePressed);

const chosen = computed(() => props.lines.find((line) => line.chosen) ?? null);

function keyOf(value: Viewer): string {
  return value.kind === "me" ? value.kind : `user:${value.username}`;
}

function escapePressed(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.defaultPrevented || props.asking || openFor.value === null) {
    return;
  }
  event.preventDefault();
  void dismiss();
}

async function openerClick(): Promise<void> {
  await openerClicked("person");
  box.value?.narrowBox?.focus();
}

async function pick(line: PersonLine<Person>): Promise<void> {
  emit("pick", line.value);
  await close();
}
</script>

<template>
  <div
    class="relative flex min-w-0 items-center"
    @pointerenter="pointerEntered('person')"
    @pointerleave="pointerLeft"
  >
    <button
      ref="opener"
      v-tooltip="PERSON_MENU"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="openFor === 'person'"
      class="flex min-w-0 items-center gap-1.5 rounded border border-control-border py-1 pr-2.5 pl-1.5 hover:bg-hover aria-expanded:bg-row-selected"
      @click="openerClick"
    >
      <MergeRequestPicture :person="chosen?.person ?? null" size="box" aria-hidden="true" />
      <span class="truncate">{{ chosen?.label ?? PERSON_MENU }}</span>
    </button>
    <MergeRequestMenu
      ref="box"
      :choices="lines"
      :name="PEOPLE"
      :open="openFor === 'person'"
      :above="above"
      @menu-key="menuKey"
    >
      <template #default="{ shown }">
        <ul role="menu" :aria-label="PERSON_MENU" class="min-h-0 overflow-y-auto">
          <li v-for="line in shown" :key="keyOf(line.value)" role="none">
            <button
              type="button"
              role="menuitemradio"
              :aria-checked="line.chosen"
              class="flex w-full items-center gap-2 rounded py-1 pr-2 pl-1.5 text-left whitespace-nowrap outline-none hover:bg-hover focus:bg-row-selected"
              @click="pick(line)"
            >
              <Check v-if="line.chosen" class="size-4 shrink-0" aria-hidden="true" />
              <span v-else class="size-4 shrink-0" aria-hidden="true" />
              <MergeRequestPicture :person="line.person" size="box" aria-hidden="true" />
              <span class="truncate">{{ line.label }}</span>
            </button>
          </li>
        </ul>
      </template>
    </MergeRequestMenu>
  </div>
</template>

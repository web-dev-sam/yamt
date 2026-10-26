<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";

import { unknownPlaceholders } from "../agent";
import type { AgentSettings } from "../ipc";
import { commandField, firstMessageField, PLACEHOLDER_NAMES } from "./agentSettingsFields";
import { AI_SETTINGS_TEXT, unknownPlaceholderText, YOLO_NOTE } from "./aiText";
import { useSettingsStore } from "./settingsStore";

const BUTTON =
  "rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent";

const { settings, setAgent } = useSettingsStore();
const commandText = shallowRef("");
const messageText = shallowRef("");

const command = computed(() => commandField(settings.value.agent, commandText.value));
const message = computed(() => firstMessageField(settings.value.agent, messageText.value));
const unknown = computed(() => unknownPlaceholders(messageText.value).map(unknownPlaceholderText));

watch(() => command.value.shown, restoreCommand, { immediate: true });
watch(() => message.value.shown, restoreMessage, { immediate: true });

function restoreCommand(): void {
  commandText.value = command.value.shown;
}

function restoreMessage(): void {
  messageText.value = message.value.shown;
}

async function save(agent: AgentSettings | null): Promise<void> {
  if (agent !== null) {
    await setAgent(agent);
  }
}
</script>

<template>
  <section aria-labelledby="settings-ai" class="flex flex-col gap-4">
    <h3 id="settings-ai" class="font-semibold">{{ AI_SETTINGS_TEXT.title }}</h3>
    <section aria-labelledby="settings-ai-command">
      <h4 id="settings-ai-command" class="mb-1 text-fg-muted">{{ AI_SETTINGS_TEXT.command }}</h4>
      <form class="flex gap-2" @submit.prevent="save(command.use)">
        <input
          v-model="commandText"
          type="text"
          aria-labelledby="settings-ai-command"
          spellcheck="false"
          class="min-w-0 flex-1 rounded border border-control-border bg-panel-inline px-2 py-1 font-mono outline-none focus:border-primary"
          @keydown.esc="restoreCommand"
        />
        <button type="submit" :disabled="command.use === null" :class="BUTTON">
          {{ AI_SETTINGS_TEXT.use }}
        </button>
        <button
          type="button"
          :disabled="command.reset === null"
          :class="BUTTON"
          @click="save(command.reset)"
        >
          {{ AI_SETTINGS_TEXT.reset }}
        </button>
      </form>
      <p class="mt-1 text-fg-muted">{{ AI_SETTINGS_TEXT.commandHint }}</p>
      <p class="mt-1 text-fg-muted">{{ YOLO_NOTE }}</p>
    </section>
    <section aria-labelledby="settings-ai-message">
      <h4 id="settings-ai-message" class="mb-1 text-fg-muted">{{ AI_SETTINGS_TEXT.message }}</h4>
      <form class="flex flex-col gap-2" @submit.prevent="save(message.use)">
        <textarea
          v-model="messageText"
          aria-labelledby="settings-ai-message"
          spellcheck="false"
          rows="8"
          class="min-w-0 resize-y rounded border border-control-border bg-panel-inline px-2 py-1 font-mono outline-none focus:border-primary"
          @keydown.esc="restoreMessage"
        ></textarea>
        <div class="flex gap-2">
          <button type="submit" :disabled="message.use === null" :class="BUTTON">
            {{ AI_SETTINGS_TEXT.use }}
          </button>
          <button
            type="button"
            :disabled="message.reset === null"
            :class="BUTTON"
            @click="save(message.reset)"
          >
            {{ AI_SETTINGS_TEXT.reset }}
          </button>
        </div>
      </form>
      <ul v-if="unknown.length > 0" class="mt-1 text-problem-warning">
        <li v-for="line in unknown" :key="line">{{ line }}</li>
      </ul>
      <p class="mt-1 text-fg-muted">
        {{ AI_SETTINGS_TEXT.messageHint }}
        <span
          v-for="name in PLACEHOLDER_NAMES"
          :key="name"
          class="mr-2 font-mono whitespace-nowrap"
          >{{ name }}</span
        >
      </p>
    </section>
  </section>
</template>

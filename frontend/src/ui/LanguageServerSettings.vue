<script setup lang="ts">
import { computed, shallowRef } from "vue";

import type { RepositoryAnswer } from "../ipc";
import type { PresetChoice, ServerSpec } from "../lsp";
import ChoiceButtons from "./ChoiceButtons.vue";
import PresetPicker from "./PresetPicker.vue";
import { addedServerFields, offServers, parseAddedServer } from "./serverSetup";
import { FROM_THE_LIST_HINT, NOT_INSTALLED, projectLabel } from "./serverText";
import { useAppStore } from "./store";

const ANSWERS: readonly { readonly value: RepositoryAnswer; readonly label: string }[] = [
  { value: "start", label: "Start" },
  { value: "dontStart", label: "Don't start" },
];

const { settings, serverRoot, foundServers, answerServers, addServer, removeServer, switchServer } =
  useAppStore();
const commandText = shallowRef("");
const fileTypesText = shallowRef("");

const answer = computed(() =>
  serverRoot.value === null
    ? null
    : (settings.value.languageServers.repositories[serverRoot.value] ?? null),
);
const added = computed(() => settings.value.languageServers.added.map(addedServerFields));
const newServer = computed(() => parseAddedServer(commandText.value, fileTypesText.value));
const off = computed(() => offServers(settings.value.languageServers, serverRoot.value));

function commandOf(spec: ServerSpec): string {
  return spec.install === null
    ? [spec.command.program, ...spec.command.args].join(" ")
    : NOT_INSTALLED;
}

async function pick(value: RepositoryAnswer | "notAsked"): Promise<void> {
  if (value !== "notAsked") {
    await answerServers(value);
  }
}

function fill(choice: PresetChoice): void {
  const fields = addedServerFields(choice);
  commandText.value = fields.command;
  fileTypesText.value = fields.fileTypes;
}

async function add(): Promise<void> {
  if (newServer.value === null) {
    return;
  }
  await addServer(newServer.value);
  commandText.value = "";
  fileTypesText.value = "";
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <section v-if="serverRoot !== null" aria-labelledby="servers-repository">
      <h4 id="servers-repository" class="mb-1 text-fg-muted">This repository</h4>
      <p class="mb-2 font-mono break-all">{{ serverRoot }}</p>
      <ChoiceButtons :options="ANSWERS" :pressed="answer ?? 'notAsked'" @pick="pick" />
      <p v-if="answer === null" class="mt-1 text-fg-muted">Not asked yet</p>
    </section>
    <section v-if="serverRoot !== null" aria-labelledby="servers-found">
      <h4 id="servers-found" class="mb-1 text-fg-muted">Found in this repository</h4>
      <ul v-if="foundServers.length > 0" class="flex flex-col">
        <li
          v-for="spec in foundServers"
          :key="spec.key"
          class="flex flex-wrap gap-x-3 gap-y-1 px-2 py-1"
        >
          <label
            class="flex w-40 shrink-0 items-baseline gap-2 wrap-break-word"
            :class="{ 'text-fg-muted': off.has(spec.key) }"
          >
            <input
              type="checkbox"
              role="switch"
              class="size-4 shrink-0 self-center accent-primary"
              :checked="!off.has(spec.key)"
              @click.prevent="switchServer(spec.key, off.has(spec.key))"
            />
            {{ spec.name }}
          </label>
          <span class="w-32 shrink-0 wrap-break-word text-fg-muted">{{
            projectLabel(spec.project)
          }}</span>
          <span
            class="min-w-0 flex-1 basis-48 wrap-break-word"
            :class="spec.install === null ? 'font-mono' : 'text-fg-muted'"
          >
            {{ commandOf(spec) }}
          </span>
        </li>
      </ul>
      <p v-else class="px-2 text-fg-muted">None found.</p>
    </section>
    <section aria-labelledby="servers-added">
      <h4 id="servers-added" class="mb-1 text-fg-muted">Added by you</h4>
      <ul v-if="added.length > 0" class="mb-2 flex flex-col">
        <li
          v-for="(server, index) in added"
          :key="index"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded px-2 py-1 hover:bg-row-hover"
        >
          <span class="min-w-0 font-mono wrap-break-word">{{ server.command }}</span>
          <span class="flex min-w-0 flex-1 basis-56 items-baseline gap-3">
            <span class="min-w-0 flex-1 text-right wrap-break-word text-fg-muted">{{
              server.fileTypes
            }}</span>
            <button
              type="button"
              class="shrink-0 rounded border border-control-border px-2.5 py-0.5 hover:bg-hover"
              :aria-label="`Remove ${server.command}`"
              @click="removeServer(index)"
            >
              Remove
            </button>
          </span>
        </li>
      </ul>
      <form class="flex items-end gap-2" @submit.prevent="add">
        <PresetPicker @pick="fill" />
        <label class="flex min-w-0 flex-2 flex-col gap-1">
          Command
          <input
            v-model="commandText"
            type="text"
            spellcheck="false"
            placeholder="pylsp"
            class="rounded border border-control-border bg-panel-inline px-2 py-1 font-mono outline-none focus:border-primary"
          />
        </label>
        <label class="flex min-w-0 flex-1 flex-col gap-1">
          File types
          <input
            v-model="fileTypesText"
            type="text"
            spellcheck="false"
            placeholder="py, pyi"
            class="rounded border border-control-border bg-panel-inline px-2 py-1 font-mono outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          :disabled="newServer === null"
          class="rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
        >
          Add
        </button>
      </form>
      <p class="mt-1 text-fg-muted">
        The command is split on spaces. File types are extensions, separated by commas or spaces.
        {{ FROM_THE_LIST_HINT }}
      </p>
    </section>
  </div>
</template>

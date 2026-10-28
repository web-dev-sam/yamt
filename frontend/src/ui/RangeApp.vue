<script setup lang="ts">
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { computed, onMounted, watch } from "vue";

import { log, onWindowClose, type RangeLineCounts } from "../ipc";
import AgentSettings from "./AgentSettings.vue";
import FileList from "./FileList.vue";
import NoticeBar from "./NoticeBar.vue";
import type { NoticeRow } from "./noticeText";
import { unexpected } from "./problem";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import RangeCounts from "./RangeCounts.vue";
import RangeFileRow from "./RangeFileRow.vue";
import { folderSums } from "./rangeFolderSums";
import { useRangeStore } from "./rangeStore";
import { emptyRangeText, RANGE_LIST_LABEL } from "./rangeText";
import { sendNoticeRow } from "./rangeThreadText";
import RangeView from "./RangeView.vue";
import SettingsButton from "./SettingsButton.vue";
import { useThemeAttribute } from "./settingsStore";
import SettingsView from "./SettingsView.vue";

const {
  start,
  shown,
  shownPath,
  visited,
  problem,
  question,
  screen,
  fileListShown,
  loadSettings,
  showFile,
  fileListKey,
  dismissProblem,
  answer,
  dismissQuestion,
  gitlab,
  threads,
  ai,
  mayClose,
} = useRangeStore();
const { counts } = threads;

const focused = useWindowFocus();
useThemeAttribute();
useEventListener(window, "keydown", (event) => {
  fileListKey(event, navigator.platform);
});

const files = computed(() => start.value?.files ?? []);
const sums = computed(() => folderSums(files.value));
const emptyText = computed(() =>
  start.value !== null && start.value.files.length === 0 ? emptyRangeText(start.value) : null,
);
const sendNotice = computed((): readonly NoticeRow[] => {
  const result = gitlab.result.value;
  return result === null ? [] : [sendNoticeRow(result)];
});

watch(focused, (now) => {
  if (now) {
    void loadSettings();
    gitlab.checkOnFocus();
  }
});

onMounted(() => {
  if (ai !== null) {
    void guardClose();
  }
});

async function guardClose(): Promise<void> {
  try {
    await onWindowClose(mayClose);
  } catch (error) {
    log.error("range.close_guard_failed", { ...unexpected(error) });
  }
}

function folderLines(path: string): RangeLineCounts {
  return sums.value.get(path) ?? { kind: "notCounted" };
}
</script>

<template>
  <div class="past-window-edges flex min-w-0 flex-1 gap-island p-island">
    <FileList
      v-show="fileListShown"
      :files="files"
      :active="shownPath"
      :label="RANGE_LIST_LABEL"
      @select="showFile"
    >
      <template #file="{ file, label }">
        <RangeFileRow :file="file" :label="label" :threads="counts.get(file.id) ?? 0" />
      </template>
      <template #folder="{ path }">
        <RangeCounts :lines="folderLines(path)" class="ml-auto" />
      </template>
    </FileList>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-island">
      <div class="inside-window-edges flex shrink-0 flex-col gap-island empty:hidden">
        <ProblemBar v-if="problem !== null" :problem="problem" @close="dismissProblem" />
        <NoticeBar v-if="sendNotice.length > 0" :rows="sendNotice" @close="gitlab.dismissResult" />
      </div>
      <div class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <template v-if="start !== null">
          <RangeView
            v-for="file in visited"
            :key="file.id"
            :file="file"
            :left-side="start.left"
            :right-side="start.right"
            :shown="file.id === shown && screen.kind === 'files'"
          />
        </template>
        <div
          v-if="emptyText !== null && screen.kind === 'files'"
          class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-island"
        >
          <header class="flex h-10 shrink-0 items-center px-2">
            <SettingsButton class="ml-auto" />
          </header>
          <p class="island bg-panel px-4 py-3">{{ emptyText }}</p>
        </div>
        <SettingsView v-if="screen.kind === 'settings'">
          <AgentSettings v-if="ai !== null" />
        </SettingsView>
      </div>
    </div>
    <QuestionDialog
      v-if="question !== null"
      :question="question"
      @answer="answer"
      @dismiss="dismissQuestion"
    />
  </div>
</template>

<script setup lang="ts">
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { computed, onMounted, watch } from "vue";
import Check from "~icons/lucide/check";

import { log, onWindowClose, type RangeEntry, type RangeLineCounts } from "../ipc";
import AgentSettings from "./AgentSettings.vue";
import FileList from "./FileList.vue";
import MergeRequestDiscussionSetting from "./MergeRequestDiscussionSetting.vue";
import MergeRequestsButton from "./MergeRequestsButton.vue";
import MergeRequestsView from "./MergeRequestsView.vue";
import NoticeBar from "./NoticeBar.vue";
import type { NoticeRow } from "./noticeText";
import { unexpected } from "./problem";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import RangeCounts from "./RangeCounts.vue";
import RangeFileRow from "./RangeFileRow.vue";
import { folderSums, leftToReview, reviewedFolders } from "./rangeFolderSums";
import RangeHeadingLine from "./RangeHeadingLine.vue";
import { useRangeStore } from "./rangeStore";
import {
  columnNames,
  emptyRangeText,
  FOLDER_REVIEWED_WORD,
  LEFT_TO_REVIEW_WORD,
  RANGE_LIST_LABEL,
} from "./rangeText";
import { sendNoticeRow } from "./rangeThreadText";
import RangeView from "./RangeView.vue";
import SearchPanel from "./SearchPanel.vue";
import SettingsButton from "./SettingsButton.vue";
import { useThemeAttribute } from "./settingsStore";
import SettingsView from "./SettingsView.vue";
import SideColumn from "./SideColumn.vue";
import { viewKind, type RangeViewKind } from "./useRangeController";
import { useShiftHeld } from "./useShiftHeld";

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
  search,
  reviewed,
  listMode,
} = useRangeStore();
const { counts } = threads;
const { marks } = reviewed;

const focused = useWindowFocus();
const shift = useShiftHeld();
useThemeAttribute();
useEventListener(window, "keydown", (event) => {
  fileListKey(event, navigator.platform);
  search.toggleKey(event, navigator.platform);
});

const files = computed(() => start.value?.files ?? []);
const sums = computed(() => folderSums(files.value));
const doneFolders = computed(() => reviewedFolders(files.value, marks.value));
const leftLines = computed(() => leftToReview(files.value, marks.value));
const emptyText = computed(() =>
  start.value !== null && start.value.files.length === 0 ? emptyRangeText(start.value) : null,
);
const columns = computed(() => (start.value === null ? null : columnNames(start.value)));
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

function viewOf(file: RangeEntry): RangeViewKind {
  return viewKind(marks.value.get(file.id));
}
</script>

<template>
  <div class="past-window-edges flex min-w-0 flex-1 gap-island p-island">
    <SideColumn
      :search-shown="search.shown.value"
      :files-shown="fileListShown"
      :on-files="screen.kind === 'files'"
    >
      <template #search>
        <SearchPanel
          :search="search"
          :shown-path="screen.kind === 'files' ? shownPath : null"
          :whole="!fileListShown"
        />
      </template>
      <FileList
        v-show="fileListShown"
        :files="files"
        :active="shownPath"
        :label="RANGE_LIST_LABEL"
        :mode="listMode.mode.value"
        @select="showFile"
        @toggle-mode="listMode.toggle"
      >
        <template #total>
          <RangeCounts
            :lines="leftLines"
            muted
            role="group"
            :title="LEFT_TO_REVIEW_WORD"
            :aria-label="LEFT_TO_REVIEW_WORD"
          />
        </template>
        <template #file="{ file, label }">
          <RangeFileRow
            :file="file"
            :label="label"
            :threads="counts.get(file.id) ?? 0"
            :review="marks.get(file.id) ?? null"
          />
        </template>
        <template #folder="{ path }">
          <RangeCounts :lines="folderLines(path)" class="ml-auto" :class="{ invisible: !shift }" />
          <span
            v-if="doneFolders.has(path)"
            role="img"
            :title="FOLDER_REVIEWED_WORD"
            :aria-label="FOLDER_REVIEWED_WORD"
            class="flex shrink-0 text-fg-muted"
          >
            <Check class="size-3.5" aria-hidden="true" />
          </span>
        </template>
      </FileList>
    </SideColumn>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-island">
      <div class="inside-window-edges flex shrink-0 flex-col gap-island empty:hidden">
        <RangeHeadingLine v-if="start !== null && screen.kind === 'files'" :start="start" />
        <ProblemBar v-if="problem !== null" :problem="problem" @close="dismissProblem" />
        <NoticeBar v-if="sendNotice.length > 0" :rows="sendNotice" @close="gitlab.dismissResult" />
      </div>
      <div class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <template v-if="columns !== null">
          <RangeView
            v-for="file in visited"
            :key="`${file.id}:${viewOf(file)}`"
            :file="file"
            :columns="columns"
            :shown="file.id === shown && screen.kind === 'files'"
            :view="viewOf(file)"
          />
        </template>
        <div
          v-if="emptyText !== null"
          v-show="screen.kind === 'files'"
          class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-island"
        >
          <header class="flex h-10 shrink-0 items-center gap-1 px-2">
            <div class="ml-auto flex items-center gap-1">
              <MergeRequestsButton />
              <SettingsButton />
            </div>
          </header>
          <p class="island bg-panel px-4 py-3">{{ emptyText }}</p>
        </div>
        <SettingsView v-if="screen.kind === 'settings'">
          <MergeRequestDiscussionSetting />
          <AgentSettings v-if="ai !== null" />
        </SettingsView>
        <MergeRequestsView v-if="screen.kind === 'mergeRequests'" :asking="question !== null" />
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

<script setup lang="ts">
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { computed, onMounted, watch } from "vue";

import { useAltHold } from "./altHold";
import ChoiceView from "./ChoiceView.vue";
import FileList from "./FileList.vue";
import LanguageServerSettings from "./LanguageServerSettings.vue";
import MergeView from "./MergeView.vue";
import NoticeBar from "./NoticeBar.vue";
import { noticeRow } from "./noticeText";
import { allResolvedText } from "./operationText";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import ServerLogView from "./ServerLogView.vue";
import { useThemeAttribute } from "./settingsStore";
import SettingsView from "./SettingsView.vue";
import StopView from "./StopView.vue";
import { useAppStore } from "./store";

const {
  files,
  opened,
  choices,
  active,
  screen,
  fileListShown,
  emptyStop,
  notices,
  operation,
  question,
  allResolved,
  pick,
  refocus,
  dismissProblem,
  dismissNotice,
  answer,
  dismissQuestion,
  watchWindowClose,
  fileListKey,
} = useAppStore();

const focused = useWindowFocus();
const altHeld = useAltHold();
useThemeAttribute();
useEventListener(window, "keydown", (event) => {
  fileListKey(event, navigator.platform);
});

const resolvedLine = computed(() => allResolvedText(operation.value));
const noticeRows = computed(() => notices.value.map((notice) => noticeRow(notice)));

watch(focused, (now) => {
  if (now) {
    void refocus();
  }
});

onMounted(() => {
  void watchWindowClose();
});
</script>

<template>
  <div class="flex h-full gap-island p-island">
    <FileList
      v-show="fileListShown"
      :files="files"
      :active="active"
      :operation="operation"
      @select="pick"
    />
    <div class="ml-(--island-overlap) flex min-h-0 min-w-0 flex-1 flex-col gap-island">
      <NoticeBar v-if="noticeRows.length > 0" :rows="noticeRows" @close="dismissNotice" />
      <ProblemBar
        v-if="emptyStop.barProblem !== null"
        :problem="emptyStop.barProblem"
        @close="dismissProblem"
      />
      <p
        v-else-if="allResolved"
        role="status"
        class="shrink-0 rounded-md border border-success-border bg-success px-3 py-2 text-on-success"
      >
        {{ resolvedLine }}
      </p>
      <div class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <MergeView
          v-for="file in opened"
          :key="file.path"
          :data="file"
          :shown="file.path === active && screen.kind === 'files'"
          :minimap="altHeld"
        />
        <ChoiceView
          v-for="sides in choices"
          :key="sides.path"
          :sides="sides"
          :shown="sides.path === active && screen.kind === 'files'"
        />
        <StopView v-if="emptyStop.stopView !== null" :message="emptyStop.stopView.message" />
        <SettingsView v-if="screen.kind === 'settings'">
          <section aria-labelledby="settings-servers">
            <h3 id="settings-servers" class="mb-2 font-semibold">Language servers</h3>
            <LanguageServerSettings />
          </section>
        </SettingsView>
        <ServerLogView
          v-else-if="screen.kind === 'serverLog'"
          :key="screen.name"
          :name="screen.name"
        />
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

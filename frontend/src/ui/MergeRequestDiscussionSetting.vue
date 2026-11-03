<script setup lang="ts">
import ChoiceButtons from "./ChoiceButtons.vue";
import {
  DISCUSSION_DETAILS,
  DISCUSSION_DETAILS_HINT,
  DISCUSSION_DETAILS_OPTIONS,
} from "./mergeRequestsText";
import { useSettingsStore } from "./settingsStore";

const { settings, setDiscussionDetails } = useSettingsStore();
</script>

<template>
  <section aria-labelledby="settings-discussion-details">
    <h3 id="settings-discussion-details" class="mb-2 font-semibold">{{ DISCUSSION_DETAILS }}</h3>
    <ChoiceButtons
      :options="DISCUSSION_DETAILS_OPTIONS"
      :pressed="settings.discussionDetails"
      @pick="setDiscussionDetails"
    />
    <p class="mt-1 text-fg-muted">{{ DISCUSSION_DETAILS_HINT }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch, type Component } from "vue";
import CircleAlert from "~icons/lucide/circle-alert";
import CircleCheck from "~icons/lucide/circle-check";
import CircleMinus from "~icons/lucide/circle-minus";
import LoaderCircle from "~icons/lucide/loader-circle";
import MessageSquareText from "~icons/lucide/message-square-text";
import RotateCcw from "~icons/lucide/rotate-ccw";
import UserPlus from "~icons/lucide/user-plus";

import type { MergeRequestRow, PeopleGroup, Person, Reviewer } from "../ipc";
import {
  displayName,
  moreText,
  NO_PEOPLE_TEXT,
  peopleStack,
  reviewDone,
  reviewStateText,
  type ReviewState,
} from "../mergeRequests";
import {
  groupNotices,
  NO_PEOPLE_ASKS,
  personState,
  type PersonState,
} from "./mergeRequestPeopleLines";
import MergeRequestPeopleSearch from "./MergeRequestPeopleSearch.vue";
import MergeRequestPersonMenu from "./MergeRequestPersonMenu.vue";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import type { RerequestAsk } from "./mergeRequests";
import { useMergeRequests } from "./mergeRequestsStore";
import {
  ADD_ASSIGNEE,
  ADD_REVIEWER,
  ASSIGNEES,
  NO_ONE,
  REMOVE_ASSIGNEE,
  REMOVE_REVIEWER,
  REREQUEST_REVIEW,
  rerequestLabel,
  rerequestReplyText,
  REVIEWERS,
} from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { useHoverBox } from "./useHoverBox";

type StateLook = { readonly icon: Component; readonly tone: string };
type Review = {
  readonly look: StateLook;
  readonly stateText: string;
  readonly rerequest: { readonly label: string; readonly running: boolean } | null;
  readonly refusal: string | null;
};
type BoxLine = {
  readonly person: Person;
  readonly name: string;
  readonly state: PersonState;
  readonly review: Review | null;
};
type GroupWords = { readonly title: string; readonly add: string; readonly remove: string };
type BoxGroup = {
  readonly group: PeopleGroup;
  readonly words: GroupWords;
  readonly lines: readonly BoxLine[];
  readonly notices: readonly string[];
};

const props = defineProps<{ row: MergeRequestRow; asks: ReadonlyMap<string, RerequestAsk> }>();
const emit = defineEmits<{ rerequestReview: [username: string]; closed: [] }>();

const REVIEW_STATE_LOOKS: Readonly<Record<ReviewState, StateLook>> = {
  requested: { icon: CircleMinus, tone: "text-fg-muted" },
  reviewed: { icon: MessageSquareText, tone: "text-primary" },
  approved: { icon: CircleCheck, tone: "text-success-signal" },
  changesRequested: { icon: CircleAlert, tone: "text-problem-error" },
};
const GROUP_WORDS: Readonly<Record<PeopleGroup, GroupWords>> = {
  assignees: { title: ASSIGNEES, add: ADD_ASSIGNEE, remove: REMOVE_ASSIGNEE },
  reviewers: { title: REVIEWERS, add: ADD_REVIEWER, remove: REMOVE_REVIEWER },
};
const GROUPS: readonly PeopleGroup[] = ["assignees", "reviewers"];

const {
  peopleAsks,
  changePeople,
  searchPeople,
  endPeopleSearch,
  peopleBoxOpened,
  peopleBoxClosed,
} = useMergeRequests();
const area = useTemplateRef<HTMLSpanElement>("area");
const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef<HTMLDivElement>("box");
const { open, placement, on } = useHoverBox({
  area: () => area.value,
  opener: () => opener.value,
  box,
});
const adding = shallowRef<PeopleGroup | null>(null);

const editable = computed(() => props.row.mayRerequest);
const stack = computed(() => peopleStack(props.row.assignees, props.row.reviewers));
const groups = computed(() =>
  GROUPS.map(boxGroup).filter((group) => editable.value || group.lines.length > 0),
);
const controls = computed(
  () =>
    new Set(
      groups.value.flatMap((group) => group.lines.flatMap((line) => controlsOf(group, line))),
    ),
);

watch(open, (isOpen) => {
  if (isOpen) {
    peopleBoxOpened(props.row.iid);
    return;
  }
  boxClosed();
  emit("closed");
});
watch(controls, keepFocusInBox, { flush: "pre" });

onBeforeUnmount(() => {
  if (open.value) {
    boxClosed();
  }
});

function review(reviewer: Reviewer, name: string): Review {
  const ask = props.asks.get(reviewer.person.username);
  return {
    look: REVIEW_STATE_LOOKS[reviewer.state],
    stateText: reviewStateText(reviewer.state),
    rerequest:
      editable.value && reviewDone(reviewer.state)
        ? { label: rerequestLabel(name), running: ask?.kind === "running" }
        : null,
    refusal: ask?.kind === "refused" ? rerequestReplyText(ask.reply, name) : null,
  };
}

function boxGroup(group: PeopleGroup): BoxGroup {
  const place = {
    row: props.row,
    group,
    asks: peopleAsks.value.get(props.row.iid) ?? NO_PEOPLE_ASKS,
    platform: navigator.platform,
  };
  function line(person: Person, reviewer: Reviewer | null): BoxLine {
    const name = displayName(person);
    return {
      person,
      name,
      state: personState(place, person.username),
      review: reviewer === null ? null : review(reviewer, name),
    };
  }
  return {
    group,
    words: GROUP_WORDS[group],
    lines:
      group === "assignees"
        ? props.row.assignees.map((person) => line(person, null))
        : props.row.reviewers.map((reviewer) => line(reviewer.person, reviewer)),
    notices: groupNotices(place),
  };
}

function controlsOf(group: BoxGroup, line: BoxLine): string[] {
  const username = line.person.username;
  const rerequest = line.review !== null && line.review.rerequest !== null;
  return [
    ...(rerequest ? [`rerequest:${username}`] : []),
    ...(editable.value ? [`more:${group.group}:${username}`] : []),
  ];
}

function keepFocusInBox(kept: ReadonlySet<string>): void {
  const focused = document.activeElement;
  const control =
    focused instanceof HTMLElement && box.value?.contains(focused) === true
      ? focused.closest<HTMLElement>("[data-control]")?.dataset.control
      : undefined;
  if (control !== undefined && !kept.has(control)) {
    box.value?.focus();
  }
}

function closeField(): void {
  if (adding.value !== null) {
    endPeopleSearch();
    adding.value = null;
  }
}

function boxClosed(): void {
  peopleBoxClosed(props.row.iid);
  closeField();
}

function toggleAdding(group: PeopleGroup): void {
  if (adding.value === group) {
    closeField();
    return;
  }
  adding.value = group;
  searchPeople("");
}

function fieldClosed(group: PeopleGroup): void {
  box.value?.querySelector<HTMLElement>(`[data-add="${group}"]`)?.focus();
  closeField();
}

function remove(group: PeopleGroup, username: string): void {
  void changePeople(props.row.iid, { group, action: "remove", username });
}
</script>

<template>
  <MergeRequestPicture
    v-if="stack.shown.length === 0 && !editable"
    v-tooltip="NO_PEOPLE_TEXT"
    :person="null"
    size="stack"
    role="img"
    :aria-label="NO_PEOPLE_TEXT"
  />
  <span
    v-else
    ref="area"
    data-row-control
    class="flex cursor-default"
    @click.stop
    @pointerenter="on.pointerenter"
    @pointerleave="on.pointerleave"
    @focusin="on.focusin"
    @focusout="on.focusout"
    @keydown="on.keydown"
  >
    <button
      ref="opener"
      type="button"
      :aria-expanded="open"
      class="flex items-center rounded p-0.5 hover:bg-hover"
    >
      <MergeRequestPicture
        v-if="stack.shown.length === 0"
        v-tooltip="NO_PEOPLE_TEXT"
        :person="null"
        size="stack"
        role="img"
        :aria-label="NO_PEOPLE_TEXT"
      />
      <MergeRequestPicture
        v-for="(person, index) in stack.shown"
        :key="person.username"
        :person="person"
        size="stack"
        role="img"
        :aria-label="displayName(person)"
        class="ring-2 ring-panel"
        :class="{ '-ml-1.5': index > 0 }"
      />
      <span v-if="stack.more > 0" class="pl-1 text-xs text-fg-muted">{{
        moreText(stack.more)
      }}</span>
    </button>
    <div
      v-if="open"
      ref="box"
      tabindex="-1"
      class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 text-fg shadow-lg outline-none"
      :style="placement"
    >
      <template v-for="group in groups" :key="group.group">
        <div class="flex items-center gap-2 px-2 pt-1 pb-0.5">
          <p class="text-fg-muted">{{ group.words.title }}</p>
          <button
            v-if="editable"
            v-tooltip="group.words.add"
            type="button"
            :data-add="group.group"
            :aria-label="group.words.add"
            :aria-expanded="adding === group.group"
            class="ml-auto rounded p-1 hover:bg-hover aria-expanded:bg-row-selected"
            @click="toggleAdding(group.group)"
          >
            <UserPlus class="size-4" aria-hidden="true" />
          </button>
        </div>
        <MergeRequestPeopleSearch
          v-if="adding === group.group"
          :row="row"
          :group="group.group"
          @close="fieldClosed(group.group)"
        />
        <p v-if="group.lines.length === 0" class="px-2 py-1 text-fg-muted">{{ NO_ONE }}</p>
        <ul v-else :aria-label="group.words.title">
          <li v-for="line in group.lines" :key="line.person.username" class="px-2 py-0.5">
            <div class="flex min-h-6 items-center gap-2">
              <MergeRequestPicture :person="line.person" size="box" aria-hidden="true" />
              <span>{{ line.name }}</span>
              <span class="ml-auto flex items-center gap-0.5 pl-4">
                <template v-if="line.review !== null">
                  <button
                    v-if="line.review.rerequest !== null"
                    v-tooltip="REREQUEST_REVIEW"
                    type="button"
                    :data-control="`rerequest:${line.person.username}`"
                    :aria-label="line.review.rerequest.label"
                    :aria-busy="line.review.rerequest.running"
                    :aria-disabled="line.review.rerequest.running"
                    class="rounded p-1 not-aria-disabled:cursor-pointer hover:bg-hover aria-disabled:text-fg-muted aria-disabled:hover:bg-transparent"
                    @click="emit('rerequestReview', line.person.username)"
                  >
                    <LoaderCircle
                      v-if="line.review.rerequest.running"
                      class="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    <RotateCcw v-else class="size-4" aria-hidden="true" />
                  </button>
                  <span
                    v-tooltip="line.review.stateText"
                    role="img"
                    :aria-label="line.review.stateText"
                    class="flex p-1"
                    :class="line.review.look.tone"
                  >
                    <component :is="line.review.look.icon" class="size-4" aria-hidden="true" />
                  </span>
                </template>
                <MergeRequestPersonMenu
                  v-if="editable"
                  :data-control="`more:${group.group}:${line.person.username}`"
                  :name="line.name"
                  :item="group.words.remove"
                  :working="line.state.removing"
                  @choose="remove(group.group, line.person.username)"
                />
              </span>
            </div>
            <p
              v-if="line.review !== null && line.review.refusal !== null"
              role="status"
              class="max-w-80 pb-1 text-problem-error"
            >
              {{ line.review.refusal }}
            </p>
            <p
              v-for="(notice, index) in line.state.notices"
              :key="index"
              role="status"
              class="max-w-80 pb-1 text-problem-error"
            >
              {{ notice }}
            </p>
          </li>
        </ul>
        <p
          v-for="(notice, index) in group.notices"
          :key="index"
          role="status"
          class="max-w-80 px-2 pb-1 text-problem-error"
        >
          {{ notice }}
        </p>
      </template>
    </div>
  </span>
</template>

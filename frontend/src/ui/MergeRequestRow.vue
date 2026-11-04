<script setup lang="ts">
import { computed } from "vue";
import FileDiff from "~icons/lucide/file-diff";
import GitMerge from "~icons/lucide/git-merge";
import Info from "~icons/lucide/info";
import LoaderCircle from "~icons/lucide/loader-circle";
import StepForward from "~icons/lucide/step-forward";
import ThumbsUp from "~icons/lucide/thumbs-up";

import type { LocalMerge, MergeRequestIid, MergeRequestRow, WebPage } from "../ipc";
import {
  approversText,
  authorText,
  createdAgo,
  dateTimeText,
  rowAction,
  sizeParts,
  sizeTitle,
  type CalendarDay,
} from "../mergeRequests";
import CiStatusBox from "./CiStatusBox.vue";
import type { RowActing } from "./mergeRequestActions";
import { SHOW_DESCRIPTION } from "./mergeRequestDescriptionText";
import MergeRequestDiscussions from "./MergeRequestDiscussions.vue";
import MergeRequestDueDate from "./MergeRequestDueDate.vue";
import MergeRequestLabels from "./MergeRequestLabels.vue";
import MergeRequestLinks from "./MergeRequestLinks.vue";
import MergeRequestPeople from "./MergeRequestPeople.vue";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import MergeRequestReadiness from "./MergeRequestReadiness.vue";
import { rowReplyText } from "./mergeRequestRowReplyText";
import type { Opening, RerequestAsk } from "./mergeRequests";
import { useMergeRequests } from "./mergeRequestsStore";
import {
  approvalsText,
  mergeRequestReference,
  openChangesTitle,
  openPageTitle,
  openReplyText,
  type PageKind,
} from "./mergeRequestsText";
import { vTooltip } from "./tooltip";

const props = defineProps<{
  row: MergeRequestRow;
  now: number;
  opening: Opening | null;
  localMerge: LocalMerge;
  acting: RowActing | null;
  due: CalendarDay | null;
  asks: ReadonlyMap<string, RerequestAsk>;
  asking: boolean;
}>();
const emit = defineEmits<{
  open: [iid: MergeRequestIid];
  openPage: [clicked: PageKind, page: WebPage];
  resolve: [iid: MergeRequestIid];
  continueMerge: [iid: MergeRequestIid];
  setDue: [iid: MergeRequestIid, day: CalendarDay | null];
  rerequestReview: [iid: MergeRequestIid, username: string];
  peopleBoxClosed: [iid: MergeRequestIid];
}>();

const { description, toggleDescription } = useMergeRequests();

const mr = computed(() => mergeRequestReference(props.row.iid));
const author = computed(() => authorText(props.row.author));
const created = computed(() => createdAgo(props.row.createdAt, props.now));
const createdTitle = computed(() => dateTimeText(props.row.createdAt));
const approvals = computed(() => ({
  count: props.row.approvedBy.length,
  label: approvalsText(props.row.approvedBy.length),
  names: approversText(props.row.approvedBy),
}));
const openTitle = computed(() => openChangesTitle());
const pageTitle = computed(() => openPageTitle(props.row.iid, props.row.title));
const fetching = computed(() => props.opening?.kind === "fetching");
const refusal = computed(() =>
  props.opening?.kind === "refused" ? openReplyText(props.opening.reply, props.row.iid) : null,
);
const size = computed(() =>
  props.row.size === null
    ? null
    : { parts: sizeParts(props.row.size), title: sizeTitle(props.row.size) },
);
const action = computed(() =>
  rowAction(props.row, props.localMerge, props.acting?.kind === "running"),
);
const actionHover = computed(() =>
  action.value.kind !== "none" && action.value.state.kind === "disabled"
    ? action.value.state.hover
    : null,
);
const reply = computed(() =>
  props.acting?.kind === "replied" ? rowReplyText(props.acting.reply, props.row.iid) : null,
);
const describing = computed(() => description.value?.row.iid === props.row.iid);

function openPage(): void {
  if (props.row.page !== null) {
    emit("openPage", "mergeRequest", props.row.page);
  }
}

function describe(): void {
  void toggleDescription({ iid: props.row.iid, title: props.row.title });
}

function act(): void {
  if (action.value.kind === "resolve") {
    emit("resolve", props.row.iid);
  } else if (action.value.kind === "continue") {
    emit("continueMerge", props.row.iid);
  }
}
</script>

<template>
  <li
    class="flex flex-col gap-0.5 border-b border-separator px-3 py-2"
    :class="{
      'cursor-pointer hover:not-has-[[data-row-control]:hover]:bg-row-hover': row.page !== null,
    }"
    @click="openPage"
  >
    <div class="flex items-center gap-3">
      <MergeRequestPicture
        v-tooltip="author"
        :person="row.author"
        size="row"
        role="img"
        :aria-label="author"
      />
      <div class="flex min-w-0 flex-1 flex-col">
        <button
          v-if="row.page !== null"
          v-tooltip="pageTitle"
          type="button"
          class="max-w-full cursor-pointer self-start truncate rounded text-left"
          :aria-label="pageTitle"
          @click.stop="openPage"
        >
          {{ row.title }}
        </button>
        <span v-else v-tooltip="row.title" class="truncate">{{ row.title }}</span>
        <div class="flex min-w-0 items-center gap-2">
          <p class="min-w-0 truncate text-xs text-fg-muted">
            <span>{{ mr }}</span
            >{{ " · " }}<span v-tooltip="createdTitle">{{ created }}</span
            ><template v-if="size !== null"
              >{{ " · "
              }}<span v-tooltip="size.title"
                ><span class="text-success-signal">{{ size.parts.added }}</span
                >{{ " " }}<span class="text-problem-error">{{ size.parts.removed }}</span
                >{{ " · " }}<span class="text-fg">{{ size.parts.files }}</span></span
              ></template
            >
          </p>
          <MergeRequestLabels :labels="row.labels" />
        </div>
      </div>
      <span class="flex w-16 shrink-0">
        <MergeRequestPeople
          :row="row"
          :asks="asks"
          @rerequest-review="emit('rerequestReview', row.iid, $event)"
          @closed="emit('peopleBoxClosed', row.iid)"
        />
      </span>
      <span class="flex w-24 shrink-0">
        <MergeRequestDueDate :due="due" :now="now" @set="emit('setDue', row.iid, $event)" />
      </span>
      <span class="flex w-12 shrink-0">
        <MergeRequestDiscussions :row :now :asking />
      </span>
      <span
        v-tooltip="approvals.names"
        class="flex w-12 shrink-0 items-center gap-1"
        :class="{ 'text-fg-muted': approvals.count === 0 }"
        :aria-label="approvals.label"
      >
        <ThumbsUp class="size-4" aria-hidden="true" />
        <span aria-hidden="true">{{ approvals.count }}</span>
      </span>
      <span class="flex w-7 shrink-0 justify-center">
        <button
          v-if="row.hasDescription"
          v-tooltip="SHOW_DESCRIPTION"
          type="button"
          data-row-control
          :data-description-opener="row.iid"
          :aria-label="SHOW_DESCRIPTION"
          aria-haspopup="dialog"
          :aria-expanded="describing"
          class="shrink-0 cursor-pointer rounded p-1 hover:bg-hover"
          @click.stop="describe"
        >
          <Info class="size-4" aria-hidden="true" />
        </button>
      </span>
      <span class="flex w-7 shrink-0 justify-center">
        <MergeRequestLinks v-if="row.hasDescription" :row />
      </span>
      <span class="flex w-7 shrink-0 justify-center">
        <CiStatusBox
          v-if="row.pipeline !== null"
          :pipeline="row.pipeline"
          data-row-control
          class="cursor-default [&_button:enabled]:cursor-pointer"
          @click.stop
          @open-job="emit('openPage', 'job', $event)"
        />
      </span>
      <span class="flex w-7 shrink-0 justify-center">
        <MergeRequestReadiness :readiness="row.readiness" />
      </span>
      <span class="flex w-7 shrink-0" @click.stop>
        <span
          v-if="action.kind !== 'none'"
          v-tooltip="actionHover ?? action.label"
          data-row-control
          class="flex cursor-default"
        >
          <button
            type="button"
            :aria-label="action.label"
            :aria-busy="action.state.kind === 'running'"
            :disabled="action.state.kind !== 'enabled'"
            class="shrink-0 rounded p-1.5 hover:bg-hover enabled:cursor-pointer disabled:pointer-events-none disabled:text-fg-muted"
            @click="act"
          >
            <LoaderCircle
              v-if="action.state.kind === 'running'"
              class="size-4 animate-spin"
              aria-hidden="true"
            />
            <GitMerge v-else-if="action.kind === 'resolve'" class="size-4" aria-hidden="true" />
            <StepForward v-else class="size-4" aria-hidden="true" />
          </button>
        </span>
      </span>
      <span v-tooltip="openTitle" data-row-control class="flex shrink-0 cursor-default" @click.stop>
        <button
          type="button"
          :aria-label="openTitle"
          :aria-busy="fetching"
          :disabled="fetching"
          class="shrink-0 rounded p-1.5 hover:bg-hover enabled:cursor-pointer disabled:pointer-events-none disabled:text-fg-muted"
          @click="emit('open', row.iid)"
        >
          <LoaderCircle v-if="fetching" class="size-4 animate-spin" aria-hidden="true" />
          <FileDiff v-else class="size-4" aria-hidden="true" />
        </button>
      </span>
    </div>
    <p v-if="refusal !== null" role="status" class="text-problem-error">
      {{ refusal }}
    </p>
    <p v-if="reply !== null" role="status" :class="{ 'text-problem-error': reply.refused }">
      {{ reply.text }}
    </p>
  </li>
</template>

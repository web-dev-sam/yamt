import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type { AgentClient } from "../agent";
import type {
  AgentSettings,
  AgentSource,
  Column,
  MessageId,
  RangeEntry,
  RangeFile,
  RangeFileId,
  RangeSource,
  RangeStart,
  Theme,
  Thread,
} from "../ipc";
import { firstMessageInUse } from "./agentSettingsFields";
import { aiMayClose } from "./aiClose";
import { createAsking, type Asking } from "./asking";
import { createCollapsing, type Collapsing } from "./collapsing";
import { fileListKey, type KeyPress } from "./fileListKey";
import type { MergeRequests } from "./mergeRequests";
import { windowMergeRequests } from "./mergeRequestsStore";
import { attempt, report, type Problem } from "./problem";
import type { Question } from "./question";
import { createRangeAi, type RangeAi } from "./rangeAi";
import type { AskContext } from "./rangeAiRules";
import { createGitLabCheck, type GitLabState } from "./rangeGitLab";
import { createRangeReviewed, type RangeReviewed } from "./rangeReviewed";
import { createRangeSearch } from "./rangeSearch";
import { createRangeThreads, type RangeThreads } from "./rangeThreads";
import { threadPlaceText } from "./rangeThreadText";
import { loadView, markShown } from "./rangeVisited";
import { settingsScreen, type Screen } from "./screen";
import type { Searching } from "./searching";
import { preferencesOf, settingsActions, startSettings } from "./settings";
import type { SettingsInUse } from "./settings";
import { registerSettingsStore, type SettingsStore } from "./settingsStore";
import { openAtStart, type WindowStart } from "./startScreen";
import type { Preferences } from "./useMergeController";

/** What `main.ts` builds only under `data-ai` / `?ai` (plan row 108). */
export type RangeAgent = { readonly source: AgentSource; readonly client: AgentClient };

type RangeStoreAi = RangeAi & { readonly client: AgentClient };

export type RangeStore = SettingsStore &
  Collapsing & {
    readonly start: Readonly<ShallowRef<RangeStart | null>>;
    readonly shown: Readonly<ShallowRef<RangeFileId | null>>;
    readonly shownPath: ComputedRef<string | null>;
    readonly visited: Readonly<ShallowRef<readonly RangeEntry[]>>;
    readonly problem: Readonly<ShallowRef<Problem | null>>;
    readonly question: ComputedRef<Question | null>;
    readonly screen: Readonly<ShallowRef<Screen>>;
    readonly fileListShown: ShallowRef<boolean>;
    readonly preferences: ComputedRef<Preferences>;
    readonly threads: RangeThreads;
    readonly reviewed: RangeReviewed;
    readonly gitlab: GitLabState;
    readonly ai: RangeStoreAi | null;
    readonly search: Searching<Column>;
    readonly mergeRequests: MergeRequests;
    startUp(): Promise<void>;
    loadSettings(): Promise<void>;
    showFile(path: string): void;
    loadFile(entry: RangeEntry): Promise<RangeFile | null>;
    fileListKey(event: KeyPress, platform: string): void;
    dismissProblem(): void;
    answer(yes: boolean): void;
    dismissQuestion(): void;
    mayClose(): Promise<boolean>;
    /** Asks "Delete this comment?" first (plan row 123). */
    deleteNote(message: MessageId): Promise<void>;
  };

type Refs = {
  readonly start: ShallowRef<RangeStart | null>;
  readonly shown: ShallowRef<RangeFileId | null>;
  readonly visited: ShallowRef<readonly RangeEntry[]>;
  readonly problem: ShallowRef<Problem | null>;
  readonly screen: ShallowRef<Screen>;
  readonly settings: ShallowRef<SettingsInUse>;
  readonly fileListShown: ShallowRef<boolean>;
};

type State = Refs & {
  readonly source: RangeSource;
  readonly asking: Asking;
  readonly threads: RangeThreads;
  readonly reviewed: RangeReviewed;
  readonly gitlab: GitLabState;
  readonly agent: RangeAgent | null;
  recent: readonly RangeFileId[];
  latestSettings: number;
};

let store: RangeStore | null = null;

function createRefs(startTheme: Theme): Refs {
  return {
    start: shallowRef<RangeStart | null>(null),
    shown: shallowRef<RangeFileId | null>(null),
    visited: shallowRef<readonly RangeEntry[]>([]),
    problem: shallowRef<Problem | null>(null),
    screen: shallowRef<Screen>({ kind: "files" }),
    settings: shallowRef(startSettings(startTheme)),
    fileListShown: shallowRef(true),
  };
}

/** First message's values for a thread (plan row 113): its place, the range as typed, the compared ids. */
export function askContext(
  start: RangeStart | null,
  agent: AgentSettings,
  thread: Thread,
): AskContext | null {
  const entry = start?.files.find((file) => file.id === thread.file);
  if (start === null || entry === undefined) {
    return null;
  }
  return {
    template: firstMessageInUse(agent),
    values: {
      RELATIVE_FILE_PATH_WITH_LINE: threadPlaceText(entry, thread.place),
      RANGE: start.range,
      OLD_COMMIT: start.left.shortId,
      NEW_COMMIT: start.right.shortId,
    },
  };
}

function storeAi(state: State): RangeStoreAi | null {
  const { agent } = state;
  if (agent === null) {
    return null;
  }
  const ai = createRangeAi(agent.client, state.threads, (thread) =>
    askContext(state.start.value, state.settings.value.agent, thread),
  );
  return { ...ai, client: agent.client };
}

async function deleteNote(state: State, message: MessageId): Promise<void> {
  if ((await state.asking.ask({ kind: "deleteNote" })) === "yes") {
    await state.threads.deleteMessage(message);
  }
}

function mayClose(state: State): Promise<boolean> {
  const { agent } = state;
  return agent === null
    ? Promise.resolve(true)
    : aiMayClose({ source: agent.source, asking: state.asking, report: (p) => report(state, p) });
}

function createState(refs: Refs, source: RangeSource, agent: RangeAgent | null): State {
  function problems(problem: Problem): void {
    report(refs, problem);
  }
  const threads = createRangeThreads(source, problems);
  const state: State = {
    ...refs,
    source,
    asking: createAsking(),
    threads,
    gitlab: createGitLabCheck(source, threads, problems, refs.start),
    reviewed: createRangeReviewed(source, {
      start: refs.start,
      show: (path) => {
        showPath(state, path);
      },
      problems,
      loadView: (entry, call, problem) => loadView(state, entry, call, problem),
    }),
    agent,
    recent: [],
    latestSettings: 0,
  };
  return state;
}

export function createRangeStore(
  source: RangeSource,
  { theme, screen }: WindowStart,
  agent: RangeAgent | null,
): RangeStore {
  const refs = createRefs(theme);
  const state = createState(refs, source, agent);
  const settings = settingsActions(state);
  const shownPath = computed(() => entryOf(state, refs.shown.value)?.path ?? null);
  const mergeRequests = windowMergeRequests(source, refs);
  const created: RangeStore = {
    ...refs,
    ...createCollapsing(),
    shownPath,
    question: state.asking.question,
    preferences: computed(() => preferencesOf(refs.settings.value)),
    threads: state.threads,
    reviewed: state.reviewed,
    gitlab: state.gitlab,
    ai: storeAi(state),
    search: createRangeSearch(state, {
      open: (path) => {
        showPath(state, path);
      },
      shownPath: () => shownPath.value,
    }),
    mergeRequests,
    ...settings,
    startUp: () => startUp(state, [settings.loadSettings(), openAtStart(mergeRequests, screen)]),
    loadFile: (entry) => loadFile(state, entry),
    mayClose: () => mayClose(state),
    deleteNote: (message) => deleteNote(state, message),
    ...chromeActions(state),
  };
  store = created;
  registerSettingsStore(created);
  return created;
}

function chromeActions(
  state: State,
): Pick<
  RangeStore,
  | "showFile"
  | "fileListKey"
  | "dismissProblem"
  | "answer"
  | "dismissQuestion"
  | "openSettings"
  | "closeSettings"
> {
  return {
    showFile: (path) => {
      showPath(state, path);
    },
    fileListKey: (event, platform) => {
      fileListKey(state, event, platform);
    },
    dismissProblem: () => {
      state.problem.value = null;
    },
    answer: state.asking.answer,
    dismissQuestion: state.asking.dismiss,
    ...settingsScreen(state.screen),
  };
}

function entryOf(state: State, file: RangeFileId | null): RangeEntry | undefined {
  return state.start.value?.files.find((entry) => entry.id === file);
}

function showPath(state: State, path: string): void {
  const entry = state.start.value?.files.find((file) => file.path === path);
  if (entry !== undefined) {
    state.screen.value = { kind: "files" };
    markShown(state, entry);
  }
}

async function startUp(state: State, besides: readonly Promise<void>[]): Promise<void> {
  const [outcome] = await Promise.all([attempt(() => state.source.openRange()), ...besides]);
  if (!outcome.ok) {
    report(state, { action: "openRange", cause: outcome.cause });
    return;
  }
  state.start.value = outcome.value;
  const threads = state.threads.load();
  await state.reviewed.load();
  const [first] = outcome.value.files;
  if (first !== undefined) {
    markShown(state, first);
  }
  await Promise.all([threads, state.gitlab.checkNow()]);
}

function loadFile(state: State, entry: RangeEntry): Promise<RangeFile | null> {
  return loadView(
    state,
    entry,
    () => state.source.loadRangeFile(entry.id),
    (cause) => ({ action: "open", path: entry.path, cause }),
  );
}

export function useRangeStore(): RangeStore {
  if (store === null) {
    throw new Error("useRangeStore() called before createRangeStore()");
  }
  return store;
}

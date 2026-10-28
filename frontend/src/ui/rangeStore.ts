import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type { AgentClient } from "../agent";
import type {
  AgentSettings,
  AgentSource,
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
import { attempt, clearProblemAbout, report, type Problem } from "./problem";
import type { Question } from "./question";
import { createRangeAi, type RangeAi } from "./rangeAi";
import type { AskContext } from "./rangeAiRules";
import { createGitLabCheck, type GitLabState } from "./rangeGitLab";
import { createRangeThreads, type RangeThreads } from "./rangeThreads";
import { threadPlaceText } from "./rangeThreadText";
import type { Screen } from "./screen";
import { preferencesOf, settingsActions, startSettings } from "./settings";
import type { SettingsActions, SettingsInUse } from "./settings";
import { registerSettingsStore, type SettingsStore } from "./settingsStore";
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
    readonly gitlab: GitLabState;
    readonly ai: RangeStoreAi | null;
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
  readonly gitlab: GitLabState;
  readonly agent: RangeAgent | null;
  recent: readonly RangeFileId[];
  latestSettings: number;
};

export const MOUNTED_FILES = 16;

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
      RELATIVE_FILE_PATH_WITH_LINE: threadPlaceText(entry, thread.line),
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
  return {
    ...refs,
    source,
    asking: createAsking(),
    threads,
    gitlab: createGitLabCheck(source, threads, problems, refs.start),
    agent,
    recent: [],
    latestSettings: 0,
  };
}

export function createRangeStore(
  source: RangeSource,
  startTheme: Theme,
  agent: RangeAgent | null,
): RangeStore {
  const refs = createRefs(startTheme);
  const state = createState(refs, source, agent);
  const settings = settingsActions(state);
  const created: RangeStore = {
    ...refs,
    ...createCollapsing(),
    shownPath: computed(() => entryOf(state, refs.shown.value)?.path ?? null),
    question: state.asking.question,
    preferences: computed(() => preferencesOf(refs.settings.value)),
    threads: state.threads,
    gitlab: state.gitlab,
    ai: storeAi(state),
    ...settings,
    startUp: () => startUp(state, settings),
    showFile: (path) => {
      const entry = state.start.value?.files.find((file) => file.path === path);
      if (entry !== undefined) {
        show(state, entry);
      }
    },
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
  "fileListKey" | "dismissProblem" | "answer" | "dismissQuestion" | "openSettings" | "closeSettings"
> {
  return {
    fileListKey: (event, platform) => {
      fileListKey(state, event, platform);
    },
    dismissProblem: () => {
      state.problem.value = null;
    },
    answer: state.asking.answer,
    dismissQuestion: state.asking.dismiss,
    openSettings: () => {
      state.screen.value = { kind: "settings" };
    },
    closeSettings: () => {
      state.screen.value = { kind: "files" };
    },
  };
}

function entryOf(state: State, file: RangeFileId | null): RangeEntry | undefined {
  return state.start.value?.files.find((entry) => entry.id === file);
}

function show(state: State, entry: RangeEntry): void {
  const { id } = entry;
  state.screen.value = { kind: "files" };
  state.shown.value = id;
  state.recent = [...state.recent.filter((each) => each !== id), id];
  if (state.visited.value.some((each) => each.id === id)) {
    return;
  }
  const [oldest, ...kept] = state.recent;
  const visited = [...state.visited.value, entry];
  if (visited.length > MOUNTED_FILES) {
    state.recent = kept;
    state.visited.value = visited.filter((each) => each.id !== oldest);
  } else {
    state.visited.value = visited;
  }
}

function forget(state: State, file: RangeFileId): void {
  state.recent = state.recent.filter((each) => each !== file);
  state.visited.value = state.visited.value.filter((each) => each.id !== file);
}

async function startUp(state: State, settings: SettingsActions): Promise<void> {
  const [outcome] = await Promise.all([
    attempt(() => state.source.openRange()),
    settings.loadSettings(),
  ]);
  if (!outcome.ok) {
    report(state, { action: "openRange", cause: outcome.cause });
    return;
  }
  state.start.value = outcome.value;
  const [first] = outcome.value.files;
  if (first !== undefined) {
    show(state, first);
  }
  await Promise.all([state.threads.load(), state.gitlab.checkNow()]);
}

async function loadFile(state: State, entry: RangeEntry): Promise<RangeFile | null> {
  const { id, path } = entry;
  const outcome = await attempt(() => state.source.loadRangeFile(id));
  if (!outcome.ok) {
    forget(state, id);
    report(state, { action: "open", path, cause: outcome.cause });
    return null;
  }
  clearProblemAbout(state, path);
  return outcome.value;
}

export function useRangeStore(): RangeStore {
  if (store === null) {
    throw new Error("useRangeStore() called before createRangeStore()");
  }
  return store;
}

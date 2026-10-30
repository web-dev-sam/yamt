import { computed, shallowReactive, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  type ChunkSource,
  type DiskVersion,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type OperationView,
  type ServerHost,
  type Side,
  type SideNames,
  type Theme,
} from "../ipc";
import type { LanguageServers } from "../lsp";
import { createAborting, type Aborting } from "./aborting";
import { createAsking, type Asking } from "./asking";
import { createCloseGuard, type CloseGuard } from "./closeGuard";
import { createCollapsing, type Collapsing } from "./collapsing";
import { createContinuing, type Continuing } from "./continuing";
import { emptyStop, type EmptyStop } from "./emptyStop";
import { fileListKey, type KeyPress } from "./fileListKey";
import { createGitRun, type GitRun } from "./gitRun";
import { refreshFiles } from "./listing";
import { createMergeSearch, type MergeSearch } from "./mergeSearch";
import { noticeKey, type Notice } from "./noticeText";
import { open, pick, thenMoveOn } from "./opening";
import { createPaneSplit, type PaneSplitState } from "./paneSplit";
import type { Problem } from "./problem";
import type { Question } from "./question";
import { createSaving, finish, reset, take } from "./saving";
import type { FinishRequest, FormatOutcomes, Saving, Writing } from "./saving";
import { settingsScreen, type Screen, type SettingsScreen } from "./screen";
import { createServers, type Servers } from "./servers";
import { createServerSetup, type ServerSetup } from "./serverSetup";
import { preferencesOf, settingsActions, startSettings } from "./settings";
import type { SettingsActions, SettingsInUse } from "./settings";
import { registerSettingsStore } from "./settingsStore";
import type { Taken } from "./sides";
import { nextStop, searchOnceListed, type StopEnd } from "./stops";
import { createHiddenButtons, type HiddenButtons, type ToolbarButtonId } from "./toolbarButtons";
import type { FormatOutcome, Preferences } from "./useMergeController";

type Refs = {
  readonly files: ShallowRef<readonly FileEntry[]>;
  readonly operation: ShallowRef<OperationView | null>;
  readonly opened: ShallowRef<readonly FileMergeData[]>;
  readonly choices: ShallowRef<readonly FileSides[]>;
  readonly taken: ShallowRef<ReadonlyMap<string, Taken>>;
  readonly notices: ShallowRef<readonly Notice[]>;
  readonly sideNames: ShallowRef<SideNames>;
  readonly active: ShallowRef<string | null>;
  readonly problem: ShallowRef<Problem | null>;
  readonly screen: ShallowRef<Screen>;
  readonly formatOutcomes: FormatOutcomes;
  readonly settings: ShallowRef<SettingsInUse>;
  readonly fileListShown: ShallowRef<boolean>;
};

type State = Refs &
  Writing &
  MergeSearch & {
    readonly source: ChunkSource;
    readonly asking: Asking;
    readonly guard: CloseGuard;
    readonly gitRun: GitRun;
    readonly stopMessage: ShallowRef<string | null>;
    latestOpen: number;
    searchWaitsForList: boolean;
    latestSettings: number;
    readonly loadFiles: () => Promise<readonly FileEntry[] | null>;
    readonly refreshFiles: () => Promise<void>;
    readonly nextStop: (end: StopEnd) => Promise<void>;
  };

type Actions = CloseGuard &
  MergeSearch &
  SettingsActions &
  SettingsScreen & {
    loadFiles(): Promise<void>;
    refreshFiles(): Promise<void>;
    nextStop(end: StopEnd): Promise<void>;
    open(path: string): Promise<void>;
    pick(path: string): Promise<void>;
    finish(request: FinishRequest): Promise<void>;
    takeSide(path: string, side: Side, diskVersion: DiskVersion): Promise<void>;
    reset(path: string, diskVersion: DiskVersion): Promise<void>;
    dismissProblem(): void;
    dismissNotice(key: string): void;
    answer(yes: boolean): void;
    dismissQuestion(): void;
    toggleButton(id: ToolbarButtonId): void;
    fileListKey(event: KeyPress, platform: string): void;
  };

export type AppStore = { readonly [K in keyof Refs]: Readonly<Refs[K]> } & {
  readonly question: ComputedRef<Question | null>;
  readonly allResolved: ComputedRef<boolean>;
  readonly emptyStop: ComputedRef<EmptyStop>;
  readonly preferences: ComputedRef<Preferences>;
  readonly hiddenButtons: HiddenButtons["hidden"];
} & Actions &
  Aborting &
  Continuing &
  Collapsing &
  PaneSplitState &
  Saving &
  Servers &
  ServerSetup;

let store: AppStore | null = null;

function createRefs(startTheme: Theme): Refs {
  return {
    files: shallowRef<readonly FileEntry[]>([]),
    operation: shallowRef<OperationView | null>(null),
    opened: shallowRef<readonly FileMergeData[]>([]),
    choices: shallowRef<readonly FileSides[]>([]),
    taken: shallowRef<ReadonlyMap<string, Taken>>(new Map()),
    notices: shallowRef<readonly Notice[]>([]),
    sideNames: shallowRef<SideNames>({ local: null, remote: null }),
    active: shallowRef<string | null>(null),
    problem: shallowRef<Problem | null>(null),
    screen: shallowRef<Screen>({ kind: "files" }),
    formatOutcomes: shallowRef<ReadonlyMap<string, FormatOutcome>>(new Map()),
    settings: shallowRef(startSettings(startTheme)),
    fileListShown: shallowRef(true),
  };
}

function createState(refs: Refs, source: ChunkSource): State {
  const asking = createAsking();
  const gitRun = createGitRun();
  const state: State = {
    ...refs,
    source,
    asking,
    guard: createCloseGuard({ ...refs, asking, running: gitRun.running }),
    gitRun,
    stopMessage: shallowRef(null),
    writing: shallowReactive(new Map()),
    stop: { dropped: false },
    latestOpen: 0,
    searchWaitsForList: false,
    latestSettings: 0,
    loadFiles: () => loadFiles(state),
    refreshFiles: async () => {
      searchOnceListed(state, await refreshFiles(state, "running"));
    },
    nextStop: (end) => nextStop(state, end),
    ...createMergeSearch(
      {
        ...refs,
        source,
        asking,
        currentStop: () => state.stop,
        nextStop: (end) => state.nextStop(end),
      },
      (path) => pick(state, path),
    ),
  };
  return state;
}

export function createAppStore(
  source: ChunkSource,
  startTheme: Theme,
  servers: LanguageServers,
  host: ServerHost | null,
): AppStore {
  const refs = createRefs(startTheme);
  const state = createState(refs, source);
  const buttons = createHiddenButtons();
  const { files, settings } = refs;
  const acts = actions(state, buttons, settingsActions(state));
  store = {
    ...refs,
    question: state.asking.question,
    allResolved: computed(
      () => files.value.length > 0 && files.value.every((file) => file.status === "Resolved"),
    ),
    emptyStop: computed(() =>
      emptyStop({
        operation: refs.operation.value,
        files: files.value,
        screen: refs.screen.value,
        problem: refs.problem.value,
        stopMessage: state.stopMessage.value,
      }),
    ),
    preferences: computed(() => preferencesOf(settings.value)),
    hiddenButtons: buttons.hidden,
    ...acts,
    ...createCollapsing(),
    ...createPaneSplit(),
    ...createAborting(state),
    ...createContinuing(state),
    ...createSaving(state),
    ...createServers(refs.screen, servers),
    ...createServerSetup({ ...state, ...acts, host, servers }),
  };
  registerSettingsStore(store);
  return store;
}

function actions(state: State, buttons: HiddenButtons, settings: SettingsActions): Actions {
  return {
    loadFiles: async () => {
      await state.loadFiles();
    },
    refreshFiles: state.refreshFiles,
    nextStop: state.nextStop,
    open: (path) => open(state, path),
    pick: (path) => pick(state, path),
    finish: (request) => thenMoveOn(state, request.path, () => finish(state, request)),
    takeSide: (path, side, diskVersion) =>
      thenMoveOn(state, path, () => take(state, path, side, diskVersion)),
    reset: (path, diskVersion) => reset(state, path, diskVersion),
    dismissProblem: () => {
      state.problem.value = null;
    },
    dismissNotice: (key) => {
      state.notices.value = state.notices.value.filter((notice) => noticeKey(notice) !== key);
    },
    answer: state.asking.answer,
    dismissQuestion: state.asking.dismiss,
    toggleButton: buttons.toggle,
    fileListKey: (event, platform) => {
      fileListKey(state, event, platform);
    },
    ...state.guard,
    search: state.search,
    liveResults: state.liveResults,
    ...settings,
    ...settingsScreen(state.screen),
  };
}

async function loadFiles(state: State): Promise<readonly FileEntry[] | null> {
  const listed = await refreshFiles(state, "start");
  const first = listed?.find((file) => file.unsupported === null) ?? listed?.[0];
  if (first !== undefined) {
    await open(state, first.path);
  }
  return listed;
}

export function useAppStore(): AppStore {
  if (store === null) {
    throw new Error("useAppStore() called before createAppStore()");
  }
  return store;
}

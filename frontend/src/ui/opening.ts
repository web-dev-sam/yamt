import type { ShallowRef } from "vue";

import type { FileListView } from "./fileListMode";
import { sidebarOrder } from "./fileTree";
import { nextUnresolved } from "./nextFile";
import { logProblem, reportFailure, type EndsStop, type Problem } from "./problem";
import type { Screen } from "./screen";
import { fetchView, isShown, type Shown } from "./views";

export type Opening = Shown &
  EndsStop & {
    readonly active: ShallowRef<string | null>;
    readonly screen: ShallowRef<Screen>;
    readonly listMode: Pick<FileListView, "mode">;
    latestOpen: number;
  };

export async function thenMoveOn(
  state: Opening,
  path: string,
  write: () => Promise<boolean>,
): Promise<void> {
  const opensBefore = state.latestOpen;
  if (await write()) {
    await moveOn(state, path, opensBefore);
  }
}

export async function pick(state: Opening, path: string): Promise<void> {
  state.screen.value = { kind: "files" };
  await open(state, path);
}

export async function open(state: Opening, path: string): Promise<void> {
  if (!isShown(state, path)) {
    await load(state, path);
    return;
  }
  if (path === state.active.value) {
    return;
  }
  state.latestOpen += 1;
  state.active.value = path;
  state.problem.value = null;
}

async function load(state: Opening, path: string): Promise<void> {
  state.latestOpen += 1;
  const ticket = state.latestOpen;
  const view = await fetchView(state, path);
  const current = ticket === state.latestOpen;
  if (!view.ok) {
    const failure: Problem = { action: "open", path, cause: view.cause };
    if (current) {
      await reportFailure(state, failure);
    } else {
      logProblem(failure);
    }
    return;
  }
  if (current) {
    view.value();
    state.active.value = path;
    state.problem.value = null;
  }
}

async function moveOn(state: Opening, path: string, opensBefore: number): Promise<void> {
  const untouched = state.active.value === path && state.latestOpen === opensBefore;
  const files = sidebarOrder(state.files.value, state.listMode.mode.value);
  const next = untouched ? nextUnresolved(files, path) : null;
  if (next !== null) {
    await open(state, next);
  }
}

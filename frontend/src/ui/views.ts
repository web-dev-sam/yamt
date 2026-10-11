import type { ShallowRef } from "vue";

import { log, type ChunkSource, type FileEntry, type FileMergeData, type FileSides } from "../ipc";
import { attempt, logProblem, type Outcome, type Problem } from "./problem";

export type Shown = {
  readonly source: ChunkSource;
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly opened: ShallowRef<readonly FileMergeData[]>;
  readonly choices: ShallowRef<readonly FileSides[]>;
  readonly problem: ShallowRef<Problem | null>;
};

export function isShown(shown: Shown, path: string): boolean {
  return (
    shown.opened.value.some((file) => file.path === path) ||
    shown.choices.value.some((sides) => sides.path === path)
  );
}

export function takesASide(shown: Shown, path: string): boolean {
  return shown.files.value.some((file) => file.path === path && file.unsupported !== null);
}

export function isEditable({ deleted, middle }: FileMergeData): boolean {
  return deleted === null && middle.kind !== "DiskNotText";
}

function putOpened(shown: Shown, data: FileMergeData): void {
  // A new object, so a kept view rebuilds its editor even when the source returns the record it cached.
  const loaded = { ...data };
  const opened = shown.opened.value;
  shown.opened.value = opened.some((file) => file.path === data.path)
    ? opened.map((file) => (file.path === data.path ? loaded : file))
    : [...opened, loaded];
  log.info("file.loaded", { path: data.path, chunks: loaded.chunks.length });
}

function putChoice(shown: Shown, sides: FileSides): void {
  const others = shown.choices.value.filter((choice) => choice.path !== sides.path);
  shown.choices.value = [...others, sides];
}

export async function fetchView(shown: Shown, path: string): Promise<Outcome<() => void>> {
  const listed = shown.files.value.find((file) => file.path === path);
  if ((listed?.unsupported ?? null) !== null) {
    const sides = await attempt(() => shown.source.describeFile(path));
    return sides.ok ? { ok: true, value: () => putChoice(shown, sides.value) } : sides;
  }
  const data = await attempt(() => shown.source.loadFile(path));
  return data.ok ? { ok: true, value: () => putOpened(shown, data.value) } : data;
}

export async function reload(shown: Shown, path: string): Promise<boolean> {
  const view = await fetchView(shown, path);
  if (!view.ok) {
    const failure: Problem = { action: "open", path, cause: view.cause };
    logProblem(failure);
    shown.problem.value = failure;
    return false;
  }
  view.value();
  return true;
}

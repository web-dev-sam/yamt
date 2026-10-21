import type { FileEntry } from "../ipc";

export function nextUnresolved(files: readonly FileEntry[], active: string | null): string | null {
  const at = files.findIndex((file) => file.path === active);
  const wrapped = [...files.slice(at + 1), ...files.slice(0, at + 1)];
  const next = wrapped.find((file) => file.status !== "Resolved" && file.path !== active);
  return next?.path ?? null;
}

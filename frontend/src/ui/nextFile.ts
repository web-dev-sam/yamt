import type { FileEntry } from "../ipc";

export function nextOpen<F extends { readonly path: string }>(
  files: readonly F[],
  active: string | null,
  done: (file: F) => boolean,
): string | null {
  const at = files.findIndex((file) => file.path === active);
  const wrapped = [...files.slice(at + 1), ...files.slice(0, at + 1)];
  const next = wrapped.find((file) => !done(file) && file.path !== active);
  return next?.path ?? null;
}

export function nextUnresolved(files: readonly FileEntry[], active: string | null): string | null {
  return nextOpen(files, active, (file) => file.status === "Resolved");
}

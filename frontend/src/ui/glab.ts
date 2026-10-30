export const GLAB_MISSING_TEXT = "glab is not installed (not found on PATH)";

export const RECHECK_PAUSE_MS = 30_000;

export function glabNotLoggedInText(detail: string): string {
  return `glab is not logged in: ${detail}`;
}

export function glabFailedText(message: string): string {
  return `glab failed: ${message}`;
}

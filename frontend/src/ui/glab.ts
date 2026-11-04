export const GLAB_MISSING_TEXT = "glab is not installed (not found on PATH)";

export const RECHECK_PAUSE_MS = 30_000;

export function glabNotLoggedInText(detail: string): string {
  return `glab is not logged in: ${detail}`;
}

export function glabFailedText(message: string): string {
  return `glab failed: ${message}`;
}

export function glabRetryText(
  refusal:
    | { readonly kind: "glabMissing" }
    | { readonly kind: "notLoggedIn"; readonly detail: string },
): string {
  switch (refusal.kind) {
    case "glabMissing":
      return `${GLAB_MISSING_TEXT} — install glab, then Retry.`;
    case "notLoggedIn":
      return `${glabNotLoggedInText(refusal.detail)} — run glab auth login in a terminal, then Retry.`;
    default: {
      const _exhaustive: never = refusal;
      return _exhaustive;
    }
  }
}

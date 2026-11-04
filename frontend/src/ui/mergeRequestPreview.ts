import { localPreview } from "../editor";
import {
  log,
  type Description,
  type MarkdownPreviewReply,
  type MergeRequestIid,
  type MergeRequestSource,
} from "../ipc";
import { attempt, type ProblemCause } from "./problem";

export type Preview =
  | { readonly kind: "writing" }
  | { readonly kind: "empty" }
  | { readonly kind: "loading" }
  | { readonly kind: "read"; readonly preview: Description }
  | {
      readonly kind: "refused";
      readonly reply: Exclude<MarkdownPreviewReply, { readonly kind: "read" }>;
    }
  | { readonly kind: "failed"; readonly cause: ProblemCause };

/** `text` drawn by yamt itself: `empty` when blank, else read when `localPreview` renders it as GitLab would (plan §2
 *  row 186), at once with no call; null when GitLab must. Logs `mergeRequests.preview_local { iid, blocks }` (counts
 *  only, never the text). */
export function previewHere(iid: MergeRequestIid, text: string): Preview | null {
  if (text.trim() === "") {
    return { kind: "empty" };
  }
  const preview = localPreview(text);
  if (preview === null) {
    return null;
  }
  log.info("mergeRequests.preview_local", { iid, blocks: preview.blocks.length });
  return { kind: "read", preview };
}

/** C7: `text` as GitLab renders it in merge request `iid`'s project; the caller words a blank text itself. */
export async function readPreview(
  source: MergeRequestSource,
  iid: MergeRequestIid,
  text: string,
): Promise<Preview> {
  const started = performance.now();
  const outcome = await attempt(() => source.previewMarkdown(iid, text));
  const ms = Math.round(performance.now() - started);
  if (!outcome.ok) {
    log.info("mergeRequests.preview_read", { iid, kind: outcome.cause.kind, ms });
    return { kind: "failed", cause: outcome.cause };
  }
  const reply = outcome.value;
  log.info("mergeRequests.preview_read", { iid, kind: reply.kind, ms });
  return reply.kind === "read"
    ? { kind: "read", preview: reply.preview }
    : { kind: "refused", reply };
}

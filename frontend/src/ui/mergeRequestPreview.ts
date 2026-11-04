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

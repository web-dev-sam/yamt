import { shallowRef, type ShallowRef } from "vue";

import {
  log,
  type Description,
  type DescriptionImage,
  type DescriptionReply,
  type MergeRequestIid,
  type MergeRequestSource,
} from "../ipc";
import { attempt, type Outcome, type ProblemCause } from "./problem";

export type DescribedRow = { readonly iid: MergeRequestIid; readonly title: string };
export type DescriptionLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "shown"; readonly description: Description }
  | {
      readonly kind: "refused";
      readonly reply: Exclude<DescriptionReply, { readonly kind: "read" }>;
    }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type ShownDescription = { readonly row: DescribedRow; readonly load: DescriptionLoad };
export type Descriptions = {
  /** The window's one description panel: null when none is open. */
  readonly description: Readonly<ShallowRef<ShownDescription | null>>;
  /** Opens `row`'s panel and asks GitLab afresh; closes it when `row` is the one open (a second click on its
   *  button); another row's replaces it. */
  toggleDescription(row: DescribedRow): Promise<void>;
  /** Asks again for the open panel's row (Retry): loading, then the reply; nothing when none is open. */
  retryDescription(): Promise<void>;
  closeDescription(): void;
  /** What an image loads: the picture scheme's address for an upload, its own for another site's, null when refused. */
  imageAddress(image: DescriptionImage): string | null;
};

type Shown = ShallowRef<ShownDescription | null>;

function settledLoad(outcome: Outcome<DescriptionReply>): DescriptionLoad {
  if (!outcome.ok) {
    return { kind: "failed", cause: outcome.cause };
  }
  const reply = outcome.value;
  return reply.kind === "read"
    ? { kind: "shown", description: reply.description }
    : { kind: "refused", reply };
}

function loggedFields(
  iid: MergeRequestIid,
  load: DescriptionLoad,
  ms: number,
): Record<string, string | number | boolean> {
  return load.kind === "shown"
    ? { iid, kind: load.kind, blocks: load.description.blocks.length, ms }
    : { iid, kind: load.kind, ms };
}

async function ask(shown: Shown, source: MergeRequestSource, row: DescribedRow): Promise<void> {
  const entry: ShownDescription = { row, load: { kind: "loading" } };
  shown.value = entry;
  const asked = performance.now();
  const outcome = await attempt(() => source.readDescription(row.iid));
  if (shown.value !== entry) {
    return;
  }
  const load = settledLoad(outcome);
  shown.value = { row, load };
  log.info(
    "mergeRequests.description_shown",
    loggedFields(row.iid, load, Math.round(performance.now() - asked)),
  );
}

function imageAddress(source: MergeRequestSource, image: DescriptionImage): string | null {
  switch (image.kind) {
    case "uploaded":
      return source.uploadedImage(image.key);
    case "web":
      return image.address;
    case "refused":
      return null;
    default: {
      const _exhaustive: never = image;
      return _exhaustive;
    }
  }
}

export function createDescriptions(deps: { readonly source: MergeRequestSource }): Descriptions {
  const shown: Shown = shallowRef<ShownDescription | null>(null);
  return {
    description: shown,
    toggleDescription: async (row) => {
      if (shown.value?.row.iid === row.iid) {
        shown.value = null;
        return;
      }
      await ask(shown, deps.source, row);
    },
    retryDescription: async () => {
      const current = shown.value;
      if (current !== null) {
        await ask(shown, deps.source, current.row);
      }
    },
    closeDescription: () => {
      shown.value = null;
    },
    imageAddress: (image) => imageAddress(deps.source, image),
  };
}

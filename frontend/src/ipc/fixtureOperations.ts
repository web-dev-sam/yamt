import type { ChunkSource } from "./ChunkSource";
import type { FileEntry, OperationView, SideName, SourceFailure, SourceResult } from "./domain";
import type { Log } from "./log";

const OPERATIONS = ["merge", "squash", "rebase", "cherry-pick", "revert", "am", "none"] as const;

type FixtureOperation = (typeof OPERATIONS)[number];

type CommitName = Extract<SideName, { kind: "Commit" }>;

const MAIN: SideName = { kind: "Branch", name: "main" };
const FEATURE = "feature/reminders";

const COMMITS: readonly [CommitName, ...CommitName[]] = [
  {
    kind: "Commit",
    short_id: "3f1c2a9",
    subject: "Add reminder dates",
    message: "Add reminder dates\n\nCards keep a due date.",
  },
  {
    kind: "Commit",
    short_id: "8b4e7d0",
    subject: "Show reminders on the board",
    message: "Show reminders on the board\n\nA bell marks a card that is due.",
  },
  {
    kind: "Commit",
    short_id: "c92a5e1",
    subject: "Store reminders",
    message: "Store reminders\n\nReminders survive a reload.",
  },
];

/** The fixture files as listed now, and making every one unresolved again for the next step. */
type StopFiles = {
  readonly listed: () => FileEntry[];
  readonly unresolveAll: () => void;
};

/** What fixture mode's git is doing: chosen by `?operation=`, advanced by Continue. */
type FixtureStops = Pick<
  ChunkSource,
  "listFiles" | "listStop" | "continueOperation" | "abortOperation"
>;

/** How the app answers every command once git finished or aborted the operation. */
type Ended = Extract<SourceFailure, { kind: "MergeFinished" | "MergeAborted" }>;

/** Where the chosen operation is: its step, or ended by the last Continue or Abort. */
type Sequence = {
  readonly operation: FixtureOperation;
  readonly rewords: boolean;
  step: number;
  ended: Ended | null;
};

function refused<T>(failure: SourceFailure): SourceResult<T> {
  return { ok: false, failure };
}

const NO_OPERATION: SourceFailure = { kind: "NoOperation" };

function stepView(
  operation: FixtureOperation,
  step: number,
  rewords: boolean,
): OperationView | null {
  const commit = COMMITS[step - 1] ?? COMMITS[0];
  const progress = { step, total: COMMITS.length };
  const merging: SideName = { kind: "Branch", name: FEATURE };
  switch (operation) {
    case "merge":
      return { kind: "Merge", merging, into: MAIN };
    case "squash":
      return { kind: "SquashMerge", merging, into: MAIN };
    case "rebase":
      return {
        kind: "Rebase",
        branch: FEATURE,
        onto: MAIN,
        replaying: commit,
        progress,
        editor_steps_ahead: rewords,
      };
    case "cherry-pick":
      return { kind: "CherryPick", picking: commit, progress };
    case "revert":
      return { kind: "Revert", reverting: { ...commit, kind: "Revert" }, progress };
    case "am":
      return { kind: "Am", subject: commit.subject, message: commit.message, progress };
    case "none":
      return null;
    default: {
      const _exhaustive: never = operation;
      return _exhaustive;
    }
  }
}

/** `?operation=merge|squash|rebase|cherry-pick|revert|am|none` (merge when missing), `?rewords`. */
function sequenceOf(search: string): Sequence {
  const params = new URLSearchParams(search);
  const chosen = params.get("operation");
  const operation = OPERATIONS.find((each) => each === chosen) ?? "merge";
  return { operation, rewords: params.has("rewords"), step: 1, ended: null };
}

function stopListings(at: Sequence, files: StopFiles): Pick<ChunkSource, "listFiles" | "listStop"> {
  return {
    async listFiles() {
      if (at.ended !== null) {
        return refused(at.ended);
      }
      const merging = at.operation === "merge";
      return { ok: true, value: { files: files.listed(), diskChanges: [], merging } };
    },
    async listStop() {
      if (at.ended !== null) {
        return refused(at.ended);
      }
      const view = stepView(at.operation, at.step, at.rewords);
      const sides = { local: view?.kind === "Rebase" ? view.replaying : null, remote: null };
      const value = { files: files.listed(), diskChanges: [], operation: view, sides };
      return { ok: true, value: { kind: "Files", ...value } };
    },
  };
}

function stopActions(
  log: Log,
  at: Sequence,
  files: StopFiles,
): Pick<ChunkSource, "continueOperation" | "abortOperation"> {
  const { operation } = at;
  return {
    async continueOperation() {
      if (at.ended !== null) {
        return refused(at.ended);
      }
      const view = stepView(operation, at.step, at.rewords);
      if (view === null) {
        return refused(NO_OPERATION);
      }
      if (view.kind === "Merge" || view.kind === "SquashMerge" || at.step === COMMITS.length) {
        at.ended = { kind: "MergeFinished" };
        log.info("fixture.continue_finished", { operation });
        return { ok: true, value: { kind: "Finished" } };
      }
      at.step += 1;
      files.unresolveAll();
      const message = `CONFLICT (content): Merge conflict at step ${at.step} of ${COMMITS.length}`;
      return { ok: true, value: { kind: "Stopped", message } };
    },
    async abortOperation() {
      if (at.ended !== null) {
        return refused(at.ended);
      }
      if (stepView(operation, at.step, at.rewords) === null) {
        return refused(NO_OPERATION);
      }
      at.ended = { kind: "MergeAborted" };
      log.info("fixture.abort_operation", { operation });
      return { ok: true, value: null };
    },
  };
}

export function createFixtureStops(log: Log, search: string, files: StopFiles): FixtureStops {
  const at = sequenceOf(search);
  return { ...stopListings(at, files), ...stopActions(log, at, files) };
}

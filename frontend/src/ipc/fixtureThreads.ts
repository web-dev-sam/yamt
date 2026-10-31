import type * as Generated from "./bindings";
import { pendingPosting, REFUSAL } from "./fixtureGitLab";
import type { RangeStart } from "./rangeDomain";

type Seed = Pick<Generated.Thread, "place" | "session"> & {
  readonly messages: readonly Omit<Generated.Message, "id" | "written">[];
};

export const SEEDED_DRAFT_NOTE = 101;

const SEEDED_PATH = "src/board/board.ts";
const SEEDED_WRITTEN = 1_767_225_600;
const SEEDED_SESSION = "fixture-session";
const NOT_QUEUED: Generated.Posting = { kind: "notQueued" };

function note(text: string, posting: Generated.Posting): Seed["messages"][number] {
  return { body: { kind: "note", text }, posting };
}

function lineSeeds(): readonly Seed[] {
  const queued = "Why does the overdue check go?";
  const refused = "This needs a test.";
  const pending = "Rename this to `cardsOf`?";
  return [
    {
      place: { start: { kind: "removed", left: 19 }, end: { kind: "removed", left: 19 } },
      messages: [note(queued, { kind: "queued", text: queued })],
      session: null,
    },
    {
      place: { start: { kind: "added", right: 20 }, end: { kind: "added", right: 20 } },
      messages: [note(refused, { kind: "refused", text: refused, reason: REFUSAL })],
      session: null,
    },
    {
      place: {
        start: { kind: "unchanged", left: 5, right: 5 },
        end: { kind: "unchangedOnLeft", left: 5, right: 5 },
      },
      messages: [note(pending, pendingPosting(pending, SEEDED_DRAFT_NOTE))],
      session: null,
    },
    {
      place: {
        start: { kind: "unchanged", left: 100, right: 101 },
        end: { kind: "unchangedOnRight", left: 100, right: 101 },
      },
      messages: [
        note("Is this still used?", NOT_QUEUED),
        { body: { kind: "aiAnswer", session: SEEDED_SESSION, turn: 0 }, posting: NOT_QUEUED },
      ],
      session: SEEDED_SESSION,
    },
  ];
}

function rangeSeeds(): readonly Seed[] {
  return [
    {
      place: {
        start: { kind: "unchanged", left: 400, right: 388 },
        end: { kind: "added", right: 405 },
      },
      messages: [note("Does the snooze need a column of its own?", NOT_QUEUED)],
      session: null,
    },
    {
      place: { start: { kind: "removed", left: 254 }, end: { kind: "added", right: 259 } },
      messages: [note("Why does the limit check move?", NOT_QUEUED)],
      session: null,
    },
  ];
}

function seededThreads(file: number): Generated.Thread[] {
  let nextMessage = 0;
  return [...lineSeeds(), ...rangeSeeds()].map((seed, id) => {
    const messages = seed.messages.map((each) => {
      const message = { ...each, id: nextMessage, written: SEEDED_WRITTEN };
      nextMessage += 1;
      return message;
    });
    return { ...seed, id, file, messages };
  });
}

/** `?threads=seeded`: one thread of each line kind on board.ts, every posting kind, an AI answer and two range threads. */
export function startThreads(search: string, start: RangeStart): Generated.Thread[] {
  const seeded = start.files.find((entry) => entry.path === SEEDED_PATH);
  const asked = new URLSearchParams(search).get("threads");
  return asked === "seeded" && seeded !== undefined ? seededThreads(seeded.id) : [];
}

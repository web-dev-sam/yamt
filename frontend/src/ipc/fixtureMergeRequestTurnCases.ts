import type * as Generated from "./bindings";
import { LOCKED_THREADS_IID, ORIGIN, PEOPLE, THREADS_IID } from "./fixtureMergeRequestData";
import { fixtureWebImage, pixels, richDescriptionBlocks } from "./fixtureMergeRequestDescriptions";

/** Who wrote a comment (null: a deleted user) and its text; the people its `@username`s name are its mentions. */
type Said = readonly [author: string | null, text: string];
type Inline = Generated.DescriptionInline;

/** A person note as the fixture keeps it: the thread's comment, and the box's text and mentions. */
export type FixtureComment = Generated.DiscussionComment &
  Pick<Generated.DiscussionNote, "text" | "mentions">;
export type FixtureDiscussion = {
  readonly id: string;
  readonly place: Generated.DiscussionPlace;
  readonly mayResolve: boolean;
  resolved: boolean;
  readonly comments: FixtureComment[];
  readonly drafts: Generated.PendingDraft[];
};
/** Where a seeded merge request's discussions start: `now` the store's creation, `firstNote` its next note number. */
type Seed = { readonly iid: number; readonly now: number; readonly firstNote: number };

const HOUR_MS = 3_600_000;
const HALF_HOUR_MS = 1_800_000;
const STARTED_HOURS_AGO = 48;
const HEX = 16;
const ID_DIGITS = 40;
const SKETCH_PERCENT = 50;
const OPTIONS_WIDTH_PX = 160;
const OPTIONS_HEIGHT_PX = 80;
const OPTIONS_SERIAL = 1;
const DUE_SERIAL = 4;
const COPY_SERIAL = 5;
const STRONG = "**";
const PEOPLE_PAGES = "https://gitlab.com";
const MARKS = /(\*\*[^*]+\*\*|@[\w-]+(?:\.[\w-]+)*)/u;
const MENTIONS = /@([\w-]+(?:\.[\w-]+)*)/gu;
const CODE_SPANS = /`[^`]*`/gu;
const OPTIONS_TEXT = "Two options for the snooze menu, see below. What do you think, @ben?";

/** The turn rule's cases (`docs/slices/briefs/mr-threads-fixtures.md` "!90's discussions"), d01 first. */
const THREADS_CASES: readonly (readonly Said[])[] = [
  [
    ["anna", OPTIONS_TEXT],
    ["sam", "I'd keep the first option, it is simpler."],
    ["dmitri", "Like this, as `@sam` drew it."],
    ["anna", "Agreed, the second one then."],
  ],
  [
    ["anna", "Should the reminder keep its time?"],
    ["sam", "Yes, it keeps it."],
  ],
  [
    ["sam", "Is the snooze menu in the right place?"],
    ["anna", "It is, but it needs a label."],
  ],
  [
    ["ben", "@sam the due date moves by a day here."],
    ["chiara", "It is the time zone."],
  ],
  [
    ["anna", "@sam can you check the copy?"],
    ["sam", "Changed it."],
    ["anna", "Not quite yet."],
  ],
  [
    ["chiara", "This query is slow."],
    ["anna", "@ben you wrote it, any idea?"],
  ],
  [
    ["anna", "The test is flaky."],
    ["anna", "It failed again on main."],
  ],
  [
    ["anna", "Please split this commit."],
    ["dmitri", "Split in two."],
  ],
  [["dmitri", "I'd like a second look at the cache."]],
  [
    [null, "This was written by a removed account."],
    [null, "So was this."],
  ],
  [
    ["chiara", "The icon is blurry."],
    ["ben", "@dmitri can you export it again?"],
  ],
  [
    ["ben", "Ready for another round."],
    ["chiara", "@all @taskboard/devs please test it today."],
  ],
  [["chiara", "Note to @chiara: remove the flag after the release."]],
];
/** "!91's discussions", on !636: its first may not be resolved. */
const LOCKED_CASES: readonly (readonly Said[])[] = [
  [
    ["anna", "Why the new column?"],
    ["sam", "For the review state."],
  ],
  [
    ["sam", "I'll rename this later."],
    ["sam", "Renamed."],
  ],
  [
    ["anna", "The colours clash."],
    ["anna", "The dark theme too."],
  ],
];
const LOCKED_FIRST_SERIAL = THREADS_CASES.length + 1;
const DRAFTS: Readonly<Record<string, string>> = {
  [discussionId(OPTIONS_SERIAL)]: "I'll take the second option.",
  [discussionId(COPY_SERIAL)]: "Agreed, I'll fix the copy.",
};
const PLACES: Readonly<Record<string, Generated.DiscussionPlace>> = {
  [discussionId(OPTIONS_SERIAL)]: { kind: "file", path: "src/board.ts", line: 12 },
  [discussionId(DUE_SERIAL)]: { kind: "file", path: "src/due.ts", line: 4 },
};
/** d01's comments beyond their text: every element of a description and sized images in anna's first, an edit by
 *  another person, a sized sketch beside a code `@sam` (no mention), and an edit by the author. */
const RICH_CHANGES: readonly ((comment: FixtureComment) => FixtureComment)[] = [
  (comment) => ({ ...comment, body: optionsBody() }),
  (comment) => edited(comment, "dmitri"),
  (comment) => ({ ...comment, body: sketchBody() }),
  (comment) => edited(comment, "anna"),
];

export function discussionId(serial: number): string {
  return serial.toString(HEX).padStart(ID_DIGITS, "0");
}

function personNamed(username: string | null): Generated.Person | null {
  return PEOPLE.find((person) => person.username === username) ?? null;
}

function mention(name: string): Inline {
  const page = `${PEOPLE_PAGES}/${name.slice(1)}`;
  return { kind: "link", link: { kind: "page", page }, inlines: [{ kind: "text", text: name }] };
}

function inlines(line: string): Inline[] {
  return line
    .split(MARKS)
    .filter((piece) => piece !== "")
    .map((piece): Inline => {
      if (piece.startsWith(STRONG)) {
        const strong = piece.slice(STRONG.length, -STRONG.length);
        return { kind: "strong", inlines: [{ kind: "text", text: strong }] };
      }
      return piece.startsWith("@") ? mention(piece) : { kind: "text", text: piece };
    });
}

/** `text` as the fixture's GitLab renders it: a paragraph per non-empty line, `**x**` strong, `@name` a link to the
 *  person's page. */
export function renderedText(text: string): Generated.Description {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return { blocks: lines.map((line) => ({ kind: "paragraph", inlines: inlines(line) })) };
}

/** GitLab links a person's `@username`, never one in code (design §1.2). */
function mentionsIn(text: string): Generated.Mention[] {
  return [...text.replace(CODE_SPANS, "").matchAll(MENTIONS)].flatMap((match) => {
    const named = personNamed(match[1] ?? null);
    return named === null ? [] : [{ username: named.username, name: named.name }];
  });
}

/** `said` at `time` as a comment on `iid` whose page is note `note`. */
export function textComment(iid: number, said: Said, time: number, note: number): FixtureComment {
  const [author, text] = said;
  return {
    author: personNamed(author),
    createdAt: new Date(time).toISOString(),
    edited: null,
    body: renderedText(text),
    page: `${ORIGIN}/-/merge_requests/${iid}#note_${note}`,
    text,
    mentions: mentionsIn(text),
  };
}

function edited(comment: FixtureComment, username: string): FixtureComment {
  const by = personNamed(username);
  if (by === null) {
    throw new Error(`the fixture has no person ${username}`);
  }
  const at = new Date(Date.parse(comment.createdAt) + HALF_HOUR_MS).toISOString();
  return { ...comment, edited: { at, by } };
}

function optionsBody(): Generated.Description {
  const sized = fixtureWebImage("both options", {
    kind: "both",
    width: pixels(OPTIONS_WIDTH_PX),
    height: pixels(OPTIONS_HEIGHT_PX),
  });
  return {
    blocks: [
      ...richDescriptionBlocks(),
      { kind: "paragraph", inlines: [sized] },
      { kind: "paragraph", inlines: inlines(OPTIONS_TEXT) },
    ],
  };
}

function sketchBody(): Generated.Description {
  const sketch = fixtureWebImage("the sketch", {
    kind: "width",
    width: { kind: "percent", value: SKETCH_PERCENT },
  });
  const drawn: Inline[] = [
    { kind: "text", text: "Like this, as " },
    { kind: "code", text: "@sam" },
    { kind: "text", text: " drew it: " },
    sketch,
  ];
  return { blocks: [{ kind: "paragraph", inlines: drawn }] };
}

/** Each discussion's comments an hour apart from two days before `now`, its last `at + 1` hours before it. */
function scripted(
  seed: Seed,
  cases: readonly (readonly Said[])[],
  firstSerial: number,
): FixtureDiscussion[] {
  const { iid, now } = seed;
  const started = now - STARTED_HOURS_AGO * HOUR_MS;
  let note = seed.firstNote;
  return cases.map((said, at) => {
    const id = discussionId(firstSerial + at);
    const last = now - (at + 1) * HOUR_MS;
    const comments = said.map((each, index) => {
      const time = index === said.length - 1 ? last : started + index * HOUR_MS;
      const comment = textComment(iid, each, time, note + index);
      const change = id === discussionId(OPTIONS_SERIAL) ? RICH_CHANGES[index] : undefined;
      return change === undefined ? comment : change(comment);
    });
    note += comments.length;
    const draft = DRAFTS[id];
    return {
      id,
      place: PLACES[id] ?? { kind: "overview" },
      mayResolve: id !== discussionId(LOCKED_FIRST_SERIAL),
      resolved: false,
      comments,
      drafts: draft === undefined ? [] : [{ text: draft }],
    };
  });
}

/** The scripted discussions of !637 and !636, or null for any other merge request. */
export function turnCases(seed: Seed): FixtureDiscussion[] | null {
  switch (seed.iid) {
    case THREADS_IID:
      return scripted(seed, THREADS_CASES, OPTIONS_SERIAL);
    case LOCKED_THREADS_IID:
      return scripted(seed, LOCKED_CASES, LOCKED_FIRST_SERIAL);
    default:
      return null;
  }
}

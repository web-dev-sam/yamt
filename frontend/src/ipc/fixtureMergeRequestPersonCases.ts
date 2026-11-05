import type * as Generated from "./bindings";
import {
  ANNA_CASES_IID,
  FOLD_CASE_IID,
  ORIGIN,
  OTHERS_CASE_IID,
  SAM_CASES_IID,
} from "./fixtureMergeRequestData";
import { fixtureWebImage, pixels } from "./fixtureMergeRequestDescriptions";
import { inlines, type Said } from "./fixtureMergeRequestRendering";
import {
  PERSON_FIRST_SERIAL,
  scripted,
  type FixtureDiscussion,
  type Script,
  type Seed,
} from "./fixtureMergeRequestTurnCases";

type Inline = Generated.DescriptionInline;
type PersonCase = { readonly iid: number; readonly said: readonly Said[] };

const FORMATTED_WIDTH_PX = 160;
const IMPORT_NOTES = `${ORIGIN}/-/wikis/import`;
const FORMATTED_TEXT = [
  "The **reminder** list needs a second look.",
  "The `snoozeUntil` field is never cleared.",
  `See [the import notes](${IMPORT_NOTES}) first.`,
  `![the reminder list](banner.png){width=${FORMATTED_WIDTH_PX}px}`,
  "Five lines in, the box cuts here.",
  "And this sixth line is hidden too.",
].join("\n");

/** The person view's cases (`docs/slices/briefs/mr-person-discussions-design.md` §2.7), p1 first; none mentions
 *  anyone, so each falls in the group the design names for sam and anna. */
const PERSON_CASES: readonly PersonCase[] = [
  {
    iid: ANNA_CASES_IID,
    said: [
      ["anna", FORMATTED_TEXT],
      ["ben", "It is cleared when a card closes."],
      ["chiara", "Not when it is archived, though."],
      ["dmitri", "I'll add a test for archiving."],
    ],
  },
  {
    iid: ANNA_CASES_IID,
    said: [
      ["sam", "Should the snooze menu remember the last choice?"],
      ["anna", "Yes, per board."],
    ],
  },
  {
    iid: ANNA_CASES_IID,
    said: [
      ["anna", "The reminder badge overlaps the title."],
      ["ben", "Only on narrow cards."],
      ["anna", "Narrow cards are the default on phones."],
    ],
  },
  {
    iid: SAM_CASES_IID,
    said: [
      ["sam", "This migration needs a down step."],
      ["chiara", "Added one."],
      ["sam", "It drops the wrong column."],
    ],
  },
  {
    iid: SAM_CASES_IID,
    said: [
      ["ben", "The board query runs twice."],
      ["chiara", "Once for the count."],
      ["sam", "The count could come from the first one."],
    ],
  },
  {
    iid: FOLD_CASE_IID,
    said: [
      ["ben", "Which time zone does the due date use?"],
      ["chiara", "The board's."],
      ["dmitri", "The user's, since last week."],
      ["anna", "The settings page still says the board's."],
      [null, "It was the board's before the move."],
      ["ben", "So the copy is out of date."],
      ["dmitri", "And the export too."],
      ["chiara", "The export writes UTC."],
      ["anna", "Then the import must read UTC."],
      ["ben", "It reads local time."],
      [null, "That was on purpose for old files."],
      ["dmitri", "Old files carry no zone at all."],
      ["ben", "Then local time is right for them."],
      ["chiara", "Agreed, only new files are UTC."],
    ],
  },
  {
    iid: OTHERS_CASE_IID,
    said: [
      ["dmitri", "The export button has no tooltip."],
      ["chiara", "Added one in the next commit."],
    ],
  },
];
const FORMATTED_FIRST: Script["changes"] = [(comment) => ({ ...comment, body: formattedBody() })];

/** p1's first comment as GitLab renders it: bold, inline code, a link, a sized web image, six lines in all. */
function formattedBody(): Generated.Description {
  const notes: Inline = {
    kind: "link",
    link: { kind: "page", page: IMPORT_NOTES },
    inlines: inlines("the import notes"),
  };
  const image = fixtureWebImage("the reminder list", {
    kind: "width",
    width: pixels(FORMATTED_WIDTH_PX),
  });
  const lines: Inline[][] = [
    inlines("The **reminder** list needs a second look."),
    [
      ...inlines("The "),
      { kind: "code", text: "snoozeUntil" },
      ...inlines(" field is never cleared."),
    ],
    [...inlines("See "), notes, ...inlines(" first.")],
    [image],
    inlines("Five lines in, the box cuts here."),
    inlines("And this sixth line is hidden too."),
  ];
  return { blocks: lines.map((line) => ({ kind: "paragraph", inlines: line })) };
}

/** The person cases on `seed`'s merge request, or null when it has none. Each last comment is `serial` hours before
 *  `now`, so no two cases' last comments share an hour, on one row or across rows. */
export function personCases(seed: Seed): FixtureDiscussion[] | null {
  const scripts = PERSON_CASES.flatMap(({ iid, said }, at): Script[] => {
    const serial = PERSON_FIRST_SERIAL + at;
    const changes = at === 0 ? FORMATTED_FIRST : [];
    return iid === seed.iid ? [{ serial, said, hoursAgo: serial, changes }] : [];
  });
  return scripts.length === 0 ? null : scripted(seed, scripts);
}

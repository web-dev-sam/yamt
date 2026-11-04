import type * as Generated from "./bindings";
import { ORIGIN, PEOPLE } from "./fixtureMergeRequestData";

/** Who wrote a comment (null: a deleted user) and its text; the people its `@username`s name are its mentions. */
export type Said = readonly [author: string | null, text: string];
type Inline = Generated.DescriptionInline;

/** A person note as the fixture keeps it: the thread's comment, and the box's text and mentions. */
export type FixtureComment = Generated.DiscussionComment &
  Pick<Generated.DiscussionNote, "text" | "mentions">;

const STRONG = "**";
const PEOPLE_PAGES = "https://gitlab.com";
const MARKS = /(\*\*[^*]+\*\*|@[\w-]+(?:\.[\w-]+)*)/u;
const MENTIONS = /@([\w-]+(?:\.[\w-]+)*)/gu;
const CODE_SPANS = /`[^`]*`/gu;

export function personNamed(username: string | null): Generated.Person | null {
  return PEOPLE.find((person) => person.username === username) ?? null;
}

function mention(name: string): Inline {
  const page = `${PEOPLE_PAGES}/${name.slice(1)}`;
  return { kind: "link", link: { kind: "page", page }, inlines: [{ kind: "text", text: name }] };
}

export function inlines(line: string): Inline[] {
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
export function mentionsIn(text: string): Generated.Mention[] {
  return [...text.replace(CODE_SPANS, "").matchAll(MENTIONS)].flatMap((match) => {
    const named = personNamed(match[1] ?? null);
    return named === null ? [] : [{ username: named.username, name: named.name }];
  });
}

/** `said` at `time` as a comment on `iid` whose page is note `note`. */
export function textComment(comment: {
  readonly iid: number;
  readonly said: Said;
  readonly time: number;
  readonly note: number;
}): FixtureComment {
  const [author, text] = comment.said;
  return {
    author: personNamed(author),
    createdAt: new Date(comment.time).toISOString(),
    edited: null,
    body: renderedText(text),
    page: `${ORIGIN}/-/merge_requests/${comment.iid}#note_${comment.note}`,
    text,
    mentions: mentionsIn(text),
  };
}

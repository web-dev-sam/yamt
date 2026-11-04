import type * as Generated from "./bindings";
import { toDescriptionReply } from "./descriptionDomain";
import { pause } from "./fixture";
import { TIMED_OUT } from "./fixtureGitLab";
import { BROKEN_PICTURE, fixtureRows, ORIGIN } from "./fixtureMergeRequestData";
import type { Log } from "./log";
import type { MergeRequestSource } from "./MergeRequestSource";

type Block = Generated.DescriptionBlock;
type Inline = Generated.DescriptionInline;

const RICH_DESCRIPTION_IID = 640;
const LONG_DESCRIPTION_IID = 639;
const EMPTY_DESCRIPTION_IID = 637;
const FAILS_ONCE_IID = 636;
const PLANTED_IID = 635;
const LOADING_UPLOAD = "upload~00000000000000000000000000000001";
const BROKEN_UPLOAD = "upload~00000000000000000000000000000002";
const PLANTED_TEXTS = [
  "<script>window.yamtPlanted = true</script>",
  '<img src=x onerror="window.yamtPlanted = true">',
  '<iframe src="https://evil.example/">',
];

const DESCRIPTION_PAUSE_MS = 400;
const LONG_PARAGRAPHS = 120;
const FIRST_NUMBER = 3;
const BLUE_SQUARE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVQoz2O0bvrGQApgIkn1qIZRDUNKAwBkagHTBOkobgAAAABJRU5ErkJggg==";
// Stands in for another site's https image: a `data:` address keeps the fixture offline.
const GREEN_BANNER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAIAAAAzn+mLAAAAMklEQVRIx+3OQQEAIAwEIGcUg9l2vWyx8wEJqNN3/WSnA0JCQkLpgJCQkFA6ICQkNO0BlBgBdWb1BiAAAAAASUVORK5CYII=";

function text(words: string): Inline {
  return { kind: "text", text: words };
}

function paragraph(...inlines: Inline[]): Block {
  return { kind: "paragraph", inlines };
}

function item(task: Generated.TaskBox, words: string): Generated.DescriptionItem {
  return { task, blocks: [paragraph(text(words))] };
}

function cell(
  header: boolean,
  align: Generated.CellAlign,
  words: string,
): Generated.DescriptionCell {
  return { header, align, inlines: [text(words)] };
}

function headingsAndText(): Block[] {
  return [
    { kind: "heading", level: "h1", inlines: [text("Snooze a reminder")] },
    { kind: "heading", level: "h2", inlines: [text("What changes")] },
    { kind: "heading", level: "h3", inlines: [text("Details")] },
    paragraph(
      text("Plain, "),
      { kind: "emphasis", inlines: [text("emphasis")] },
      text(", "),
      { kind: "strong", inlines: [text("strong")] },
      text(", "),
      { kind: "strike", inlines: [text("struck")] },
      text(" and "),
      { kind: "code", text: "snooze(card)" },
      { kind: "lineBreak" },
      text("after a line break."),
    ),
  ];
}

function codeAndLists(): Block[] {
  return [
    {
      kind: "code",
      language: "ruby",
      text: "def snooze(card)\n  card.update!(due: 1.day.from_now)\nend",
    },
    { kind: "code", language: null, text: "plain text\n  indented" },
    { kind: "code", language: "mermaid", text: "graph TD\n  A --> B" },
    {
      kind: "list",
      numbering: { kind: "bullets" },
      items: [item("none", "One"), item("none", "Two")],
    },
    {
      kind: "list",
      numbering: { kind: "numbers", start: FIRST_NUMBER },
      items: [item("none", "Third"), item("none", "Fourth")],
    },
    {
      kind: "list",
      numbering: { kind: "bullets" },
      items: [
        item("done", "Done task"),
        item("open", "Open task"),
        item("inapplicable", "Dropped task"),
      ],
    },
  ];
}

function tableAndContainers(): Block[] {
  return [
    {
      kind: "table",
      head: [
        {
          cells: [
            cell(true, "start", "Card"),
            cell(true, "center", "State"),
            cell(true, "end", "Days"),
          ],
        },
      ],
      body: [
        {
          cells: [
            cell(false, "start", "Login"),
            cell(false, "center", "open"),
            cell(false, "end", "3"),
          ],
        },
        {
          cells: [
            cell(false, "start", "Board"),
            cell(false, "center", "done"),
            cell(false, "end", "12"),
          ],
        },
      ],
    },
    { kind: "quote", blocks: [paragraph(text("A quoted line."))] },
    { kind: "rule" },
    {
      kind: "details",
      open: false,
      summary: [text("More")],
      blocks: [paragraph(text("Hidden until opened."))],
    },
  ];
}

function linksAndImages(): Block[] {
  function link(target: Generated.DescriptionLink, words: string): Inline {
    return { kind: "link", link: target, inlines: [text(words)] };
  }
  function image(source: Generated.DescriptionImage, caption: string): Inline {
    return { kind: "image", image: source, caption };
  }
  return [
    paragraph(
      link({ kind: "page", page: `${ORIGIN}/-/issues/12` }, "#12"),
      text(" "),
      link({ kind: "page", page: "https://docs.example/x" }, "the docs"),
      text(" "),
      link({ kind: "refused", address: "mailto:anna@example.com" }, "mail Anna"),
      text(" "),
      link({ kind: "refused", address: "javascript:window.yamtPlanted=true" }, "planted"),
    ),
    paragraph(
      image({ kind: "uploaded", key: LOADING_UPLOAD }, "screenshot"),
      image({ kind: "uploaded", key: BROKEN_UPLOAD }, "broken screenshot"),
      image({ kind: "web", address: GREEN_BANNER }, "outside picture"),
      image({ kind: "refused" }, "refused picture"),
    ),
  ];
}

function read(blocks: Block[]): Generated.DescriptionReply {
  return { kind: "read", description: { blocks } };
}

function rich(): Generated.DescriptionReply {
  return read([
    ...headingsAndText(),
    ...codeAndLists(),
    ...tableAndContainers(),
    ...linksAndImages(),
  ]);
}

/** The fixture's answer for `iid`, `firstAsk` when this window never asked it before; a listed row without a
 *  description reads empty. */
export function fixtureDescription(
  iid: number,
  firstAsk: boolean,
  listed: readonly Generated.MergeRequestRow[],
): Generated.DescriptionReply {
  switch (iid) {
    case RICH_DESCRIPTION_IID:
      return rich();
    case LONG_DESCRIPTION_IID:
      return read(
        Array.from({ length: LONG_PARAGRAPHS }, (_, at) => paragraph(text(`Paragraph ${at + 1}.`))),
      );
    case EMPTY_DESCRIPTION_IID:
      return read([]);
    case FAILS_ONCE_IID:
      return firstAsk ? { kind: "failed", message: TIMED_OUT } : rich();
    case PLANTED_IID:
      return read(PLANTED_TEXTS.map((words) => paragraph(text(words))));
    default:
      return listed.find((row) => row.iid === iid)?.hasDescription === false
        ? read([])
        : read([paragraph(text(`Description of !${iid}.`))]);
  }
}

/** Stands in for `convertFileSrc` over the picture scheme: the first upload loads, any other does not (Rust's 404). */
export function fixtureUploadedImage(key: string): string {
  return key === LOADING_UPLOAD ? BLUE_SQUARE : BROKEN_PICTURE;
}

export function descriptionScript(
  log: Log,
  listedRows: number,
): Pick<MergeRequestSource, "readDescription" | "uploadedImage"> {
  const asked = new Set<number>();
  return {
    async readDescription(iid) {
      log.info("mergeRequests.fixture_description", { iid });
      const firstAsk = !asked.has(iid);
      asked.add(iid);
      await pause(DESCRIPTION_PAUSE_MS);
      const reply = fixtureDescription(iid, firstAsk, fixtureRows(0, listedRows));
      return { ok: true, value: toDescriptionReply(reply) };
    },
    uploadedImage: fixtureUploadedImage,
  };
}

import { afterEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { isMergeRequestIid } from "./domain";
import { fixtureRows } from "./fixtureMergeRequestData";
import {
  descriptionScript,
  fixtureDescription,
  fixtureUploadedImage,
} from "./fixtureMergeRequestDescriptions";
import type { Log } from "./log";
import type { MergeRequestSource } from "./MergeRequestSource";
import { branded } from "./validate";

const LISTED_ROWS = 500;
const PAUSE_MS = 400;
const LOADING_UPLOAD = "upload~00000000000000000000000000000001";
const BROKEN_UPLOAD = "upload~00000000000000000000000000000002";
const SCRIPTED: ReadonlySet<number> = new Set([640, 639, 637, 636, 635]);

afterEach(() => {
  vi.useRealTimers();
});

function listed(): Generated.MergeRequestRow[] {
  return fixtureRows(0, LISTED_ROWS);
}

function quietLog(lines: string[]): Log {
  function keep(event: string, fields: Record<string, string | number | boolean> = {}): void {
    lines.push(`${event} ${JSON.stringify(fields)}`);
  }
  return { debug: keep, info: keep, warn: keep, error: keep };
}

function target(link: Generated.DescriptionLink): string {
  switch (link.kind) {
    case "page":
      return `page ${link.page}`;
    case "refused":
      return `refused ${link.address}`;
  }
}

function source(image: Generated.DescriptionImage): string {
  switch (image.kind) {
    case "uploaded":
      return `uploaded ${image.key}`;
    case "web":
      return image.address.startsWith("data:image/png;base64,iVBOR") ? "web png" : "web other";
    case "refused":
      return "refused";
  }
}

function lengthMark(length: Generated.ImageLength): string {
  switch (length.kind) {
    case "pixels":
      return `${length.value}px`;
    case "percent":
      return `${length.value}%`;
  }
}

function sizeMark(size: Generated.ImageSize | null): string {
  if (size === null) {
    return "";
  }
  switch (size.kind) {
    case "width":
      return ` (width ${lengthMark(size.width)})`;
    case "height":
      return ` (height ${lengthMark(size.height)})`;
    case "both":
      return ` (${lengthMark(size.width)} by ${lengthMark(size.height)})`;
  }
}

function inlineMarks(inline: Generated.DescriptionInline): string[] {
  switch (inline.kind) {
    case "text":
      return [`"${inline.text}"`];
    case "emphasis":
    case "strong":
    case "strike":
      return [inline.kind, ...inline.inlines.flatMap(inlineMarks)];
    case "code":
      return [`code ${inline.text}`];
    case "lineBreak":
      return ["lineBreak"];
    case "link":
      return [`link ${target(inline.link)}`, ...inline.inlines.flatMap(inlineMarks)];
    case "image":
      return [`image ${source(inline.image)} ${inline.caption}${sizeMark(inline.size)}`];
  }
}

function itemMarks(item: Generated.DescriptionItem): string[] {
  const task = item.task === "none" ? [] : [`task ${item.task}`];
  return [...task, ...item.blocks.flatMap(blockMarks)];
}

function rowMarks(row: Generated.DescriptionRow): string[] {
  return row.cells.flatMap((cell) => [
    `${cell.header ? "th" : "td"} ${cell.align}`,
    ...cell.inlines.flatMap(inlineMarks),
  ]);
}

function blockMarks(block: Generated.DescriptionBlock): string[] {
  switch (block.kind) {
    case "paragraph":
      return block.inlines.flatMap(inlineMarks);
    case "heading":
      return [block.level, ...block.inlines.flatMap(inlineMarks)];
    case "code":
      return [`code block ${block.language ?? "none"}: ${block.text}`];
    case "list": {
      const numbering = block.numbering;
      const kind =
        numbering.kind === "numbers" ? `numbers from ${numbering.start}` : numbering.kind;
      return [kind, ...block.items.flatMap(itemMarks)];
    }
    case "quote":
      return ["quote", ...block.blocks.flatMap(blockMarks)];
    case "rule":
      return ["rule"];
    case "table":
      return ["table", ...block.head.flatMap(rowMarks), "body", ...block.body.flatMap(rowMarks)];
    case "details":
      return [
        `details ${block.open ? "open" : "closed"}`,
        ...block.summary.flatMap(inlineMarks),
        ...block.blocks.flatMap(blockMarks),
      ];
  }
}

function blocksOf(reply: Generated.DescriptionReply): readonly Generated.DescriptionBlock[] {
  if (reply.kind !== "read") {
    throw new Error(`not read: ${reply.kind}`);
  }
  return reply.description.blocks;
}

function marksOf(reply: Generated.DescriptionReply): string[] {
  return blocksOf(reply).flatMap(blockMarks);
}

function script(lines: string[] = []): Pick<MergeRequestSource, "readDescription"> {
  return descriptionScript(quietLog(lines), LISTED_ROWS);
}

async function asked(
  described: Pick<MergeRequestSource, "readDescription">,
  iid: number,
): Promise<unknown> {
  const answer = described.readDescription(branded(iid, isMergeRequestIid, "iid"));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  return answer;
}

test("the_rich_description_holds_every_element_of_rule_3", () => {
  expect(marksOf(fixtureDescription(640, true, listed()))).toEqual([
    "h1",
    '"Snooze a reminder"',
    "h2",
    '"What changes"',
    "h3",
    '"Details"',
    '"Plain, "',
    "emphasis",
    '"emphasis"',
    '", "',
    "strong",
    '"strong"',
    '", "',
    "strike",
    '"struck"',
    '" and "',
    "code snooze(card)",
    "lineBreak",
    '"after a line break."',
    "code block ruby: def snooze(card)\n  card.update!(due: 1.day.from_now)\nend",
    "code block none: plain text\n  indented",
    "code block mermaid: graph TD\n  A --> B",
    "bullets",
    '"One"',
    '"Two"',
    "numbers from 3",
    '"Third"',
    '"Fourth"',
    "bullets",
    "task done",
    '"Done task"',
    "task open",
    '"Open task"',
    "task inapplicable",
    '"Dropped task"',
    "table",
    "th start",
    '"Card"',
    "th center",
    '"State"',
    "th end",
    '"Days"',
    "body",
    "td start",
    '"Login"',
    "td center",
    '"open"',
    "td end",
    '"3"',
    "td start",
    '"Board"',
    "td center",
    '"done"',
    "td end",
    '"12"',
    "quote",
    '"A quoted line."',
    "rule",
    "details closed",
    '"More"',
    '"Hidden until opened."',
    "link page https://gitlab.example/taskboard/taskboard/-/issues/12",
    '"#12"',
    '" "',
    "link page https://docs.example/x",
    '"the docs"',
    '" "',
    "link refused mailto:anna@example.com",
    '"mail Anna"',
    '" "',
    "link refused javascript:window.yamtPlanted=true",
    '"planted"',
    `image uploaded ${LOADING_UPLOAD} screenshot`,
    `image uploaded ${BROKEN_UPLOAD} broken screenshot`,
    "image web png outside picture",
    "image refused refused picture",
    "image web png 120 px wide (width 120px)",
    "image web png 40 % wide (width 40%)",
    "image web png 4000 px wide (width 4000px)",
    "image web png 60 px high (height 60px)",
  ]);
  expect(fixtureUploadedImage(LOADING_UPLOAD)).toMatch(/^data:image\/png;base64,iVBOR.{40}/u);
  expect(fixtureUploadedImage(BROKEN_UPLOAD)).toBe("data:image/png;base64,AAAA");
});

test("the_long_empty_and_planted_rows_answer_as_scripted", () => {
  const long = marksOf(fixtureDescription(639, true, listed()));

  expect(long).toHaveLength(120);
  expect([long[0], long[119]]).toEqual(['"Paragraph 1."', '"Paragraph 120."']);
  expect(blocksOf(fixtureDescription(637, true, listed()))).toEqual([]);
  expect(marksOf(fixtureDescription(635, true, listed()))).toEqual([
    '"<script>window.yamtPlanted = true</script>"',
    '"<img src=x onerror="window.yamtPlanted = true">"',
    '"<iframe src="https://evil.example/">"',
  ]);
});

test("the_failing_row_fails_once_then_reads", async () => {
  vi.useFakeTimers();
  const described = script();

  expect(await asked(described, 636)).toEqual({
    ok: true,
    value: { kind: "failed", message: "glab timed out" },
  });
  const rich = { ok: true, value: fixtureDescription(640, true, listed()) };
  expect(await asked(described, 636)).toEqual(rich);
  expect(await asked(described, 636)).toEqual(rich);
  expect(await asked(described, 640)).toEqual(rich);
  expect(await asked(script(), 636)).toMatchObject({ value: { kind: "failed" } });
});

test("an_ask_is_logged_at_once_and_answered_after_400_ms", async () => {
  vi.useFakeTimers();
  const lines: string[] = [];
  let answer: unknown = null;
  void script(lines)
    .readDescription(branded(637, isMergeRequestIid, "iid"))
    .then((result) => {
      answer = result;
    });

  expect(lines).toEqual(['mergeRequests.fixture_description {"iid":637}']);
  await vi.advanceTimersByTimeAsync(PAUSE_MS - 1);
  expect(answer).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  expect(answer).toEqual({ ok: true, value: { kind: "read", description: { blocks: [] } } });
});

test("every_listed_row_with_a_description_answers", () => {
  const rows = listed();
  const described = rows.filter((row) => row.hasDescription && !SCRIPTED.has(row.iid));

  expect(described.length).toBeGreaterThan(LISTED_ROWS / 2);
  for (const row of described) {
    expect(marksOf(fixtureDescription(row.iid, true, rows))).toEqual([
      `"Description of !${row.iid}."`,
    ]);
  }
});

test("a_row_without_a_description_is_scripted_as_such", () => {
  const rows = listed();
  const withoutOne = rows.filter((row) => !row.hasDescription).map((row) => row.iid);

  expect(withoutOne.slice(0, 3)).toEqual([638, 631, 624]);
  for (const iid of withoutOne) {
    expect(blocksOf(fixtureDescription(iid, true, rows))).toEqual([]);
  }
  expect(marksOf(fixtureDescription(1, true, rows))).toEqual(['"Description of !1."']);
});

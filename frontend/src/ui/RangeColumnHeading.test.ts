import { expect, test } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";

import RangeColumnHeading from "./RangeColumnHeading.vue";
import type { ColumnName } from "./rangeText";

async function heading(column: ColumnName): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(RangeColumnHeading, { column }) }));
}

test.each<[ColumnName, string]>([
  [
    { kind: "named", name: "main", branchedOff: "feature", shortId: "531ea52", subject: "Base" },
    "main where feature branched off 531ea52",
  ],
  [
    { kind: "named", name: "feature", branchedOff: null, shortId: "9c1ba3f", subject: "Remind" },
    "feature 9c1ba3f",
  ],
  [{ kind: "commit", shortId: "9c1ba3f", subject: "Remind" }, "9c1ba3f"],
])("a header of %o reads %s, words one space apart", async (column, words) => {
  expect((await heading(column)).replace(/<[^>]*>/gu, "")).toBe(words);
});

test("the name is emphasised, the note muted, the short id muted monospace, the subject the hover title", async () => {
  const html = await heading({
    kind: "named",
    name: "main",
    branchedOff: "feature",
    shortId: "531ea52",
    subject: "Base of it all",
  });

  expect(html).toContain('title="Base of it all"');
  expect(html).toContain('<span class="font-semibold text-fg">main </span>');
  expect(html).toContain('<span class="text-fg-muted">where feature branched off </span>');
  expect(html).toContain('<span class="font-mono text-fg-muted">531ea52</span>');
});

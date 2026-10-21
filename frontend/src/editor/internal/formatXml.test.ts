import { expect, test } from "vitest";

import { formatXml } from "./formatXml";

test("formatXml: nested elements are indented one level per element (catches the indent not increased on a start tag)", () => {
  expect(formatXml("<a><b><c/></b><d/></a>")).toEqual({
    kind: "formatted",
    text: "<a>\n  <b>\n    <c/>\n  </b>\n  <d/>\n</a>",
  });
  expect(formatXml("\n  <a>\n<b>\n   <c/>\n     </b>\n      </a>  \n")).toEqual({
    kind: "formatted",
    text: "<a>\n  <b>\n    <c/>\n  </b>\n</a>\n",
  });
});

test("formatXml: an element holding no child element stays on one line, its content verbatim (catches child text laid out as a block)", () => {
  expect(formatXml("<a>\n<b>text &amp; more</b>\n<c><![CDATA[x]]></c><d></d><e> </e></a>")).toEqual(
    {
      kind: "formatted",
      text: "<a>\n  <b>text &amp; more</b>\n  <c><![CDATA[x]]></c>\n  <d></d>\n  <e> </e>\n</a>",
    },
  );
});

test("formatXml: mixed content is kept verbatim from its start tag to its end tag (catches whitespace collapsed in mixed content)", () => {
  const mixed = "<p>Some   <b>bold</b>\n   and <i> <x/> </i> text</p>";

  expect(formatXml(`<doc>   ${mixed}  </doc>`)).toEqual({
    kind: "formatted",
    text: `<doc>\n  ${mixed}\n</doc>`,
  });
});

test("formatXml: declaration, comment, CDATA, DOCTYPE with an internal subset and character references are kept (catches entities resolved)", () => {
  const doctype =
    '<!DOCTYPE note [\n  <!ENTITY e "a > b">\n  <!-- ] > -->\n  <!ELEMENT note (#PCDATA)>\n]>';
  const leaf = "<t>caf&#x00E9; &#38; &e;</t>";
  const input = `<?xml version="1.0" encoding="UTF-8"?>${doctype}<!-- top --><note><?pi x?><!--c--><![CDATA[ <raw> ]]>${leaf}</note>`;

  expect(formatXml(input)).toEqual({
    kind: "formatted",
    text: `<?xml version="1.0" encoding="UTF-8"?>\n${doctype}\n<!-- top -->\n<note><?pi x?><!--c--><![CDATA[ <raw> ]]>${leaf}</note>`,
  });
});

test("formatXml: a CDATA section beside a child element is character data, so the element is mixed content kept verbatim (catches CDATA counted as text only outside the root)", () => {
  expect(formatXml("<a><b/><![CDATA[x]]></a>")).toEqual({ kind: "unchanged" });
});

test("formatXml: a processing instruction inside the DOCTYPE's internal subset is skipped like a comment (catches only comments skipped there)", () => {
  expect(formatXml("<!DOCTYPE a [<?p ]?>]><a/>")).toEqual({
    kind: "formatted",
    text: "<!DOCTYPE a [<?p ]?>]>\n<a/>",
  });
  expect(formatXml("<!DOCTYPE a [<?p it's?>]><a/>")).toEqual({
    kind: "formatted",
    text: "<!DOCTYPE a [<?p it's?>]>\n<a/>",
  });
});

test("formatXml: an end tag that does not match its start tag fails with both names and the end tag's line (catches the end-tag name not compared)", () => {
  expect(formatXml("<a>\n  <b/>\n</b>")).toEqual({
    kind: "failed",
    message: "End tag </b> does not match <a>",
    line: 3,
  });
  expect(formatXml("<a/>\n</a>")).toEqual({
    kind: "failed",
    message: "End tag </a> has no start tag",
    line: 2,
  });
});

test('formatXml: an element with xml:space="preserve" is kept verbatim (catches the attribute not checked)', () => {
  const kept = "<pre xml:space='preserve'>\n<b> x </b>\n   <c/></pre>";

  expect(formatXml(`<a><z/>${kept}</a>`)).toEqual({
    kind: "formatted",
    text: `<a>\n  <z/>\n  ${kept}\n</a>`,
  });
  expect(formatXml("<a><pre space='preserve'><b/></pre></a>")).toEqual({
    kind: "formatted",
    text: "<a>\n  <pre space='preserve'>\n    <b/>\n  </pre>\n</a>",
  });
});

test("formatXml: a self-closing tag and a start tag over two lines with quoted '>' are kept verbatim (catches quotes ignored inside a tag)", () => {
  const tag = '<b x="1"\n     y=\'a > b\' z = "/>">';

  expect(formatXml(`<a><c  k="v" /> ${tag}<d/></b></a>`)).toEqual({
    kind: "formatted",
    text: `<a>\n  <c  k="v" />\n  ${tag}\n    <d/>\n  </b>\n</a>`,
  });
});

test("formatXml: a second root, text outside the root and an unclosed element fail (catches a second root accepted)", () => {
  expect(formatXml("<a/>\n\n<b/>")).toEqual({
    kind: "failed",
    message: "A second root element <b>",
    line: 3,
  });
  expect(formatXml("<a/>\nx")).toEqual({
    kind: "failed",
    message: "Text outside the root element",
    line: 2,
  });
  expect(formatXml("<![CDATA[x]]><a/>")).toEqual({
    kind: "failed",
    message: "Text outside the root element",
    line: 1,
  });
  expect(formatXml("<a>\n<b>\n</b>")).toEqual({
    kind: "failed",
    message: "Element <a> is not closed",
    line: 1,
  });
  expect(formatXml("<!-- only -->")).toEqual({
    kind: "failed",
    message: "Expected a root element",
    line: 1,
  });
});

test("formatXml: unterminated constructs and a '<' that starts nothing fail at their start", () => {
  const starts = "'<' starts no tag, comment, CDATA section, processing instruction or DOCTYPE";

  expect(formatXml('<a>\n<b c="x>')).toEqual({
    kind: "failed",
    message: "Unterminated tag <b>",
    line: 2,
  });
  expect(formatXml("<a>\n<b <c/></a>")).toEqual({
    kind: "failed",
    message: "Unterminated tag <b>",
    line: 2,
  });
  expect(formatXml("<a></a\n")).toEqual({
    kind: "failed",
    message: "Unterminated end tag </a>",
    line: 1,
  });
  expect(formatXml("<a></>")).toEqual({
    kind: "failed",
    message: "Expected a name after '</'",
    line: 1,
  });
  expect(formatXml("<a>\n<!-- x</a>")).toEqual({
    kind: "failed",
    message: "Unterminated comment",
    line: 2,
  });
  expect(formatXml("<a><![CDATA[x</a>")).toEqual({
    kind: "failed",
    message: "Unterminated CDATA section",
    line: 1,
  });
  expect(formatXml("<?xml <a/>")).toEqual({
    kind: "failed",
    message: "Unterminated processing instruction",
    line: 1,
  });
  expect(formatXml("<!DOCTYPE a [ <!ENTITY e 'x'> <a/>")).toEqual({
    kind: "failed",
    message: "Unterminated DOCTYPE",
    line: 1,
  });
  expect(formatXml("<a>\n< b/></a>")).toEqual({ kind: "failed", message: starts, line: 2 });
  expect(formatXml("<a><!ELEMENT x></a>")).toEqual({ kind: "failed", message: starts, line: 1 });
});

test("formatXml: already formatted text is unchanged (catches always answering formatted)", () => {
  expect(formatXml('<?xml version="1.0"?>\n<a>\n  <b>t</b>\n  <c/>\n</a>\n')).toEqual({
    kind: "unchanged",
  });
  expect(formatXml("<a/>")).toEqual({ kind: "unchanged" });
  expect(formatXml("  \n ")).toEqual({ kind: "unchanged" });
});

test("formatXml: 100,000 nested elements are scanned without throwing", () => {
  const depth = 100_000;

  expect(formatXml("<a>".repeat(depth))).toEqual({
    kind: "failed",
    message: "Element <a> is not closed",
    line: 1,
  });
});

test("formatXml: a leading byte order mark is kept and the scan starts after it (catches the mark handed to the scan)", () => {
  expect(formatXml("\uFEFF\n<a><b/></a>")).toEqual({
    kind: "formatted",
    text: "\uFEFF<a>\n  <b/>\n</a>",
  });
  expect(formatXml("\uFEFF<a/>\n")).toEqual({ kind: "unchanged" });
});

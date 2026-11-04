# GitLab Markdown corpus (orchestrator, 2026-11-04)

`glab api --method POST markdown --input -` with `{"text", "gfm": true, "project": "samubr/glab-yamt-playground"}`
(the body of `crates/merge-requests/src/query/rest.rs:90` `markdown_body`), gitlab.com, logged in as samubr. 66 texts;
text → html pairs verbatim in `PlanFastPreviewCorpus.json` (same directory; the fixture source).

Observations (the designer verifies against the JSON):

- Every block carries `data-sourcepos` and `dir="auto"`; headings get `id="user-content-<slug>"` and an empty
  `<a class="anchor" href="#slug">` (duplicates `-1`); `<br>` for two trailing spaces and for a trailing backslash; a
  soft break stays a newline inside `<p>`.
- `*a*`/`_a_` → `<em>`, `**`/`__` → `<strong>`, `***x***` → `<em><strong>`, `~~` → `<del>`; intraword `_` stays text.
- Every fenced or indented code block → `div.markdown-code-block > pre.code.highlight.language-<lang>` with one
  `span.line` per line and Rouge token classes (`k`, `nf`, `p`, …); no language → `language-plaintext`; `ts` →
  `language-typescript` with `data-canonical-lang="ts"`; mermaid adds `code.js-render-mermaid`.
- Ordered list keeps `start="3"`; `1)` lists are `<ol>`; loose lists wrap items in `<p>`; nested lists nest.
- Tables: `align="left|center|right"` per cell; inline code/strong inside cells.
- `---`, `***`, `___` → `<hr>`; setext headings → `h1`/`h2`.
- `&amp; &copy; &#35;` decoded (`&amp; © #`); `a & b < c` escaped; smart punctuation NOT applied (`--`, `...`,
  straight quotes kept).
- Triggers seen: `@samubr` → user link; `:thumbsup:` and a literal 😀 → `<gl-emoji>` (a Unicode emoji character is
  a trigger); bare `https://` → link; `- [ ]` → task list; `<b>` kept as HTML; ``$`a^2`$`` → math code.
- Not linked here but would be with a real target: `#12` (playground has no issue 12), `abc1234`/`deadbeef` (no such
  commit). So the corpus cannot prove a reference trigger by GitLab's answer; the request's A2 list stands as given.
- `C#`, `# alone`, `100%`, `$5`, `note: time 10:30`, `Great!` stay plain text.

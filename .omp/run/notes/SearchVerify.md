# SearchVerify — the search feature's final runs (sessions 35–36)

Brief `docs/slices/briefs/search-verify.md` (recipes 1–6, passes 2–3 scope sections). Reports: `agent://SearchVerify`,
`agent://SearchVerify2`, `agent://SearchVerify3`.

## Pass 1 (`SearchVerify`, 20m52s, HEAD `ff174ba`)

Gate pass (`just check` exit 0, 45 s). Fixture pages ran on the owner's screen (no private bus), so 2a/2e/Ctrl+A
failures were the unfocused page; re-run on Xvfb with `document.hasFocus()` true: 13/13, 6×3/6×3, 6/6, withdrawn
(#1738). Real failures: #1735 the match off screen at the default 240 px column; #1737 a new query's list blank at the
old scroll position; #1736 hide → the Settings button. Real apps (merge, range): pass; size: "20000 results" + cut
sentence, longest frame 64 ms. → window rounds 2–3 (Gate B #1744).

## Pass 2 (`SearchVerify2`, 33m35s, HEAD `e0cd1ed`)

Gate pass (2988 web tests). Fixture pages on Xvfb, `hasFocus` true: 2a–2d, 2f–2m pass both pages, dark/light; real
merge and range apps pass (first Ctrl+Shift+S shows the panel once the language-server question is answered; choice
file → "Take left"; skipped files never listed). Failure: #1745 a side-pane icon on an already-open file left the match
out of view. Size not run (budget, hooks; #1747). → go-to rounds 2–3 (#1752).

## Pass 3 (`SearchVerify3`, 12m32s, HEAD `6ca763d`)

Gate pass (947 Rust, 2988 web). Every go-to passes in both fixtures and the real merge app (side icons on open and
unopened files, collapsed lines, Enter, keys), in view at +0/+500/+1000 ms; 2g and the saved dot pass. Size: "20000
results in 1667 files" + cut sentence; typing and scrolling during the run, longest frame 81 ms. Failures: #1754 a
query hitting the 2 MiB line → one 844 ms frame; #1755 hide with the Result focused scrolls all panes to 0. → one last
slice `SearchFinalFix`; its WebKit re-check is folded into the release run (#1757).

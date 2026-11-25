# MrHeadingSmoke

Agent output (`agent://MrHeadingSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingSmoke.md), collected 2026-11-25T10:05:07.300Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "C1/C2/C4 title bar via `DISPLAY=:3 xdotool search --name … getwindowname %@` (recipe named in mr-heading-verify.md)",
      "excerpt": "bash: line 1: xdotool: command not found  (also missing: xwininfo, wmctrl). Workaround I used, read-only: a ctypes XQueryTree walk of :3 + `xprop -id <win> _NET_WM_NAME | od -c`. The titles in C1/C2/C4 come from that. The recipe as written cannot run on this host."
    },
    {
      "step": "C2 shot --display of the second window (chips and totals)",
      "excerpt": "Display :3 has no window manager, so the second yamt window came up wider than the 1280x800 screen. /tmp/yamt-mh/verify/C2-second-dark.png shows `!13 Snooze a reminder` and the headers `main where snooze branched off 531ea52` / `snooze 6ea97d8`. Its right part (chips and `+69 −67`) is off-screen. C3 (WebDriver, same window) reads them from the DOM."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 start-fixture --range-case review --heading mergeRequest --size 1280x800",
      "observed": "line [!12 muted][title w600][CODE feature][→ muted][CODE main][+64 −67], y=5, above h3s (y=91). jq totals 64/67; counted sums 64/67. Line +64 rgb(120,191,123), −67 rgb(246,107,113), the same as file rows. h3 'main where feature branched off 531ea52' (bold/muted/mono muted), title = commit subject; 'feature 9c1ba3f'. header btn right edge 1267 ≤ 1280. /[·|•-]/ false; hex40 false",
      "pass": true
    },
    {
      "recipe": "B1 rule 4 + rule 2/7 (open 3 files, Reviewed, search, Settings)",
      "observed": "After opening 3 files, Reviewed (pressed) and search 'reminder', the line stayed '!12Reminders before a card is duefeature→main+64−67'. Settings: line hidden, 0 file rows, search hidden (B1-settings-dark.png). Back: line the same, 13 rows, search 'reminder'. `hover h3` exit 1, so the title attribute was read instead. Shots B1-search-dark, B1-back-dark, B1-light",
      "pass": true
    },
    {
      "recipe": "B2 --heading fork / hiddenFork at 1280x800 and 900x600",
      "observed": "Chips 'sam:feature/reminders-grouped-by-due-day' and '(fork) feature/…' truncate (324/347 > 254) with the full name as title. Title truncated (750 > 585 at 1280, > 205 at 900). Totals in view (right edge 1263/883); Settings button right edge 1267/887 ≤ width. Note: at 900 the right h3 truncates and hides 9c1ba3f; h3 hover is the commit subject. The '-' comes only from branch names. Shots B2-*-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "B3 --heading unnamed",
      "observed": "line ['!12','9c1ba3f','→','531ea52','+64−67']; h3 ['531ea52','9c1ba3f'] (short ids only, subjects as titles); hex40 false. Shots B-B3-unnamed-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "B4 no --heading",
      "observed": "line ['main','...','feature','+64−67'], no '!'; h3 'main where feature branched off 531ea52' / 'feature 9c1ba3f'; search pane titles 'main, where feature branched off (531ea52)' and 'feature (9c1ba3f)'. Shots B-B4-plain-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "B5 --range-case empty",
      "observed": "line ['feature','..','feature','+0−0'] above the text 'feature (9c1ba3f) and feature (9c1ba3f) have the same files.' (shot B-B5-empty-light.png). jq totals 0/0. B6: hex40 false in every case B1–B5",
      "pass": true
    },
    {
      "recipe": "C setup scripts/range-repo.sh /tmp/yamt-mh/verify/repo",
      "observed": "for-each-ref before: 9c1ba3fc… refs/heads/feature, 437805506e… refs/heads/main; status --porcelain empty. yamt-cli range main...feature: totals {added:64,removed:67}, list sums 64/67",
      "pass": true
    },
    {
      "recipe": "C1 start-app mh-page --range main...feature --glab merge-requests --mr",
      "observed": "_NET_WM_NAME \"main...feature  +64 −67 — repo — yamt\". od -c: two spaces after 'feature', U+2212 (342 210 222), U+2014 separators. On the MR page: line hidden, 0 file rows. Shot C1-page-dark.png",
      "pass": true
    },
    {
      "recipe": "C2 !12 / !13 Show Diff",
      "observed": "!12: alert '!12 is already open in another yamt window.' !13 opened pid 691441, title \"!13 Snooze a reminder  snooze → main  +69 −67 — repo — yamt\" (od: two spaces before 'snooze' and '+69'). cli totals 69/67, sums 69/67. Log: 'starting a second window … \"--review-of=taskboard/taskboard!13\", \"--mr-title=Snooze a reminder\", \"--mr-source=snooze\", \"--mr-target=main\"'. kill -TERM, then log 'a window this one started ended status=signal: 15 (SIGTERM)'. Shots C2-second-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "C3 start-app mh-child --review-of taskboard/taskboard!13 --mr-title/--mr-source/--mr-target",
      "observed": "title \"!13 Snooze a reminder  snooze → main  +69 −67 — repo — yamt\". line [!13][Snooze a reminder bold][snooze]→[main][+69−67]; h3 'main where snooze branched off 531ea52' / 'snooze 6ea97d8'; hex40 false. Queued 'check' on docs/current.md (right gutter): 'Send to GitLab (1)', title 'Send the 1 queued comment to your pending review on !13', no line-up notice. Not sent. Shots C3-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "C4 start-app mh-old --review-of only",
      "observed": "title \"!13  531ea52..6ea97d8  +69 −67 — repo — yamt\" (od: two spaces after !13 and after 6ea97d8). line ['!13','6ea97d8','→','531ea52','+69−67']; h3 ['531ea52','6ea97d8']; hex40 false. Shots C4-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "C5 refusals",
      "observed": "`yamt --diff=a..b --repo … --mr-title=x` printed 'yamt: give --mr-title, --mr-source and --mr-target together, each once' + usage, exit 2. With all three and no --review-of: 'yamt: --mr-title, --mr-source and --mr-target go with --review-of=<project>!<iid>', exit 2",
      "pass": true
    },
    {
      "recipe": "C6 repository untouched (RK40)",
      "observed": "After all runs, the for-each-ref diff against the recorded list printed 'refs-same'; status --porcelain diff printed 'status-same'",
      "pass": true
    },
    {
      "recipe": "E1 range mh-sr --heading mergeRequest --mr list (1280x450: at 800 the tree did not overflow)",
      "observed": "Before: tree scrollTop 137, docs collapsed, separator x 325, query 'reminder', line on. Settings: tree, separator, search and line hidden, content from x 9. Ctrl+B and Ctrl+Shift+S there: nothing changed. Back: scrollTop 137, separator 325, docs collapsed, query kept, line back. MR list: same hiding, keys no effect, Back restores all. Shots E1-*-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "E2 range Ctrl+B then Settings then back",
      "observed": "After Ctrl+B: tree hidden, search 'reminder' visible, line on. Settings, then Back: tree still hidden, search 'reminder' visible, separator 325. Shots E2-hidden-restored-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "E3 compare start-fixture mh-sc --diff --mr list",
      "observed": "31 tabs; Tabs list scrollTop 60 (853/708), current Compare 31. Settings: no tab list (0 Close buttons). Back: 31, scrollTop 60, Compare 31. Merge requests: same, Back scrollTop 60. Light: scrollTop 60. Shots E3-*.png",
      "pass": true
    },
    {
      "recipe": "E4 merge fixture mh-sm",
      "observed": "word-marks.ts selected. Settings: list hidden, separator gone. Back: list visible, same file selected, separator 245, in dark and light. List does not overflow (682/682). The fixture has no server log screen (no Language servers button). Separator drag exited 1. Shots E4-*.png",
      "pass": true
    },
    {
      "recipe": "E4 real app server log + list scroll: lsp-repo.sh; start-app mh-merge2 --repo …/lsp",
      "observed": "9 conflicts, servers started, tree view, search open so the tree overflows (440/408); math.ts selected, scrollTop 32. Language servers → oxlint → Show log: 'oxlint log … Starting oxlint --lsp in web', tree hidden. Back: scrollTop 32, math.ts. Settings: hidden; Back: 32. Ctrl+B on the log screen: no change. Shots E4-real*-{dark,light}.png",
      "pass": true
    }
  ],
  "environment": "HEAD 874138ea (only .omp/docs bookkeeping dirty). rustc 1.99.0, node v26.13.1, pnpm 12.0.0. cargo tauri build --debug --no-bundle + yamt-cli: exit 0. Xvfb :3 with no WM; xdotool missing, xprop used. MiniBrowser via app-session. Every session stopped. Shots in /tmp/yamt-mh/verify/. Real-app viewport is at least 600 tall."
}

# C' — one verification run over the owner's UX list

Base: `b344321` (before 3.E, 3.G, 3.W; last verified state `0b347a3`, only docs between). Since then:
3.E editor (find bar per pane, drag over apply/ignore icons as one undo step, Ctrl/Cmd+click,
read-only mode) with two follow-up rounds; 3.G Rust (deleted-on-one-side text files load, marks
follow git, `remote_name`) with two; 3.W window chrome (Mark resolved first and state-coloured, Reset
in the Result header, next unresolved file, marks refreshed on focus, right header, deleted-side view,
choice view Result column, resizable file list) with one. Board rows 7–9; decisions plan §2 #44–#50.

## Recipes (read-only; fix nothing)

1. `just check` — the whole gate. Paste each step's tail and the exit status.
2. `just mutants b344321` — cargo-mutants on Rust lines changed since the base, Stryker on the
   changed TypeScript (`editor/` is not mutated). For every surviving mutant: file:line, the
   mutation, and VF7's triage (equivalent with the reason / gate-covered naming the recipe / wiring
   observed in the smoke / real gap → owning row 7 or 8).
3. Desktop smoke on the real app (`just app --repo /tmp/yamt-verify-c2` style debug build with the
   embedded pages, driven through tauri-driver, `skill://verification` Tauri recipe; any screen is
   fine; page screenshots only, VF9) on `scripts/conflict-repo.sh /tmp/yamt-verify-c2`:
   - right header reads "Remote (theirs): remote"; left "Local (yours)".
   - a text conflict: "Mark resolved" is first in the toolbar and outlined; press an apply icon and
     drag over two more → highlighted while held, applied on release; one Ctrl+Z → all back; redo;
     Ctrl+click a tinted side block → applied; click a side pane, Ctrl+F, a word with several hits →
     "1 of N", Enter → "2 of N", panes stay aligned with the bar open, Escape closes; process
     everything → "Mark resolved" blue; click it → the next unresolved file opens; the written file
     equals the middle pane (CRLF kept on `notes/crlf.txt`).
   - `docs/removed.md`: kept side with highlights, base in the middle, "Deleted in this branch." +
     "Delete", "Keep" in the kept header; Keep → next file; back → kept text in the middle; "Reset"
     (next to "Result") → stages back, base again; Delete → `git ls-files -s` empty for it.
   - `assets/logo.bin`: three columns, Reset in the Result header, Take right → next file.
   - from a shell, `git add` another conflicted file; make the window lose and regain focus → its
     mark turns resolved and the shown file does not change (say how focus was moved; if it cannot be
     done on this display, say so and run it on a private display).
   - drag the file list's edge wider and narrower → clamps at 10rem and half the window.
   - resolve everything, close the window → exit status 0; a second fresh repo closed with files
     left → exit status 1, those files still unmerged.

Stop every process you started; remove the scratch repositories.

## Report

Output schema, every field; `gate: pass|fail` with the failing step named. Evidence verbatim.

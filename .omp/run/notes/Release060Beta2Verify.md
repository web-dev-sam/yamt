# Release060Beta2Verify — final run before tagging 0.6.0-beta.2 (session 36)

Brief `docs/slices/briefs/release-0.6.0-beta.2-verify.md`; verifier, 11m6s, `main` at `512a6fe`. Report
`agent://Release060Beta2Verify`; screenshots `/tmp/yamt-rel-0.6.0-b2/`.

- Gate pass: `just check` exit 0 in 54.5 s (947 Rust, 2990 web tests, deny ok, arch/map ok, golden 10× ok, hooks 17/17);
  `readmer check` exit 0. Licences: no diff (356 crates, 82 JS packages, 2 icon sets).
- Bundle: `yamt_0.6.0-beta.2_amd64.deb` (5.71 MiB), control `Version: 0.6.0-beta.2` (read with `ar`/`tar`: no
  `dpkg-deb` here), `usr/bin/yamt` alone, licences file equal; `yamt --version` → `yamt 0.6.0-beta.2`.
- Release binary: conflict project (search row → Result selection, hide → keyboard in the Result, Mark resolved
  stages); range window (tree sums, 6 waves and the toggle, a search into collapsed lines shows the stretch, thread,
  edit, delete, one POST with the edited text, repository unchanged); real `omp acp` turn (Ask AI at the bottom, steps
  list 320 px, exit 0, no omp left); compare window (no search panel, exit 0).
- The search's last fixes (#1757): a 2 MiB line, longest frame 22 ms (was 844), row ends in "…"; a hide keeps
  `650/650/590`, the Result focused.
- No leftovers; private bus killed. Exits 1 (merge, unresolved), 0, 0, 0, 0.
- Owner only: a real GitLab merge request; the Windows and macOS builds (CI); a real `dpkg -i`.

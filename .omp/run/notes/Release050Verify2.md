# Release050Verify2 (release 0.5.0 row 2, rerun after the --diff rename)

HEAD `8dd895d`, clean before and after. Gate **pass**. Private Xvfb, no WM; exit status via a wrapper; windows closed
with `WM_DELETE_WINDOW`. The owner's own yamt processes left alone.

1. `just check` exit 0 (1952 web tests, arch/map-check ok, 10 goldens, hooks 16/16).
2. Licences: 356 Rust crates, 82 JS packages, 2 icon sets; no diff.
3. `yamt_0.5.0_amd64.deb` 5.22 MiB; only `usr/bin/yamt`; licences byte-equal. `--version` `yamt 0.5.0`; `--help`
   names `yamt --diff`; `--raw` → "unknown argument --raw", 2; `--diff --repo x` → usage error, 2;
   `start-fixture --diff-case json-payload` → the case in tab 1.
4. Release binary: conflict project Mark resolved → staged, next file, close exit 1 "6 of 7"; rebase: tooltip at once
   with "1 of 3" and the message, no GTK tooltip after 3 s, Continue → "2 of 3", end → exit 0 `yamt: rebase finished`;
   compare (`--diff`): word difference, Format keeps key order, "+" adds Compare 2, close exit 0, restart keeps both
   tabs, second `--diff` → "another yamt --diff window is open (…)", 2; paste with a killed owner in the Result and a
   compare column → alive, unchanged, no yamt core; live owner pastes. No leftovers.

Screenshots `/tmp/yamt-rel-0.5.0/` (`rebase-tooltip-dark.png`, `compare-formatted.png`, …). Two python cores at 18:35
are the verifier's own close helper, not yamt.

# MrDocs

Agent output (`agent://MrDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrDocs.md), collected 2026-10-30T15:21:52.410Z.

{
  "summary": "The architecture doc, the project map (SKILL.md, tree.md, state.md) and the ipc-contract skill now describe the merge-request code as committed at ab820bb. Changes: new section 3.9 for the yamt-merge-requests crate and new tree rows for every new file, the four commands and ListMessage, the second-process launcher (range_window.rs) and the #94 change to the compare window, MergeRequestSource, the storedRecord helper, windowFence.ts (PM7/PM9/PM10), fakeGlab.ts and fake-open. A page fix round is still open (ab820bb), so any file it adds needs a tree row.",
  "files_changed": [
    "docs/architecture.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/ipc-contract/SKILL.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    "src-tauri/AGENTS.md:1 - the compare window is still described as never running git; it now reads remotes at start and runs glab and the fetch for the merge-request page (#94 amended). Add merge_requests.rs, range_window.rs, appimage.rs running_appimage, lib.rs from_start_dir and window.rs run_compare(folder).",
    "crates/gitio/AGENTS.md - no entry for fetch.rs (fetch_without_refs, FETCH_TIMEOUT), names.rs remote_urls/RemoteUrl, merge_config.rs config_entries, or glab.rs Glab::get/auth_status/AuthStatus/first_line/last_line/TIMED_OUT.",
    "crates/gitio/src/checkout.rs:11-13,101-102 - a third copy of the config exit-1 rule (UNSET_STATUS via config_lines); switch it to config_entries (MrDetectListR1 open risk). This is code, not docs.",
    ".omp/skills/verification/SKILL.md:95 - app-session docs lack start-app --diff --dir, --glab with --diff, glab/opened.log (fake xdg-open) and start-fixture --mr (MrPage note).",
    "src-tauri/src/lib.rs:45 - COMPARE_FOLDER repeats args.rs's private CURRENT_DIR and shares its name with compare.rs:12's COMPARE_FOLDER (MrOpenCommandsR1Boundary open risk). This is code, not docs."
  ]
}

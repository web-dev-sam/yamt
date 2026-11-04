# MrFastPreviewRememberedR1

Agent output (`agent://MrFastPreviewRememberedR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewRememberedR1.md), collected 2026-11-04T22:26:57.290Z.

{
  "summary": "All ten findings are fixed. `lost(words) -> Option<Lost { Login, Project }>` decides the forget and its logged reason (a `Forget` enum, no `&str`). GitLab's 'does not exist or you don't have permission' sentence is a lost login; auth status decides the reply. The five inline mappings go through `refusal`. The fake's `reply` uses `after_post`, and there is a new `anonymous` api-status form. README has the measured 401s and the token-less mutation answer. AGENTS.md and the MergeRequestState doc are fixed.",
  "files_changed": [
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/list.rs",
    "crates/merge-requests/src/people_search.rs",
    "crates/merge-requests/src/people_change.rs",
    "crates/merge-requests/src/rerequest.rs",
    "crates/merge-requests/src/discussion_thread/read.rs",
    "crates/merge-requests/tests/remembered.rs",
    "crates/merge-requests/tests/people.rs",
    "crates/merge-requests/AGENTS.md",
    "scripts/fake-glab/glab",
    "tests/glab/README.md",
    "tests/glab/mr-remembered/api-status.after-post-7",
    "tests/glab/mr-remembered/auth-status.after-post-7.out",
    "tests/glab/mr-remembered/auth-status.after-post-7.exit",
    "tests/glab/mr-remembered/graphql-merge-request-90.json",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "project::tests::lost_reads_glabs_words (replaces is_lost_reads_glabs_words)",
      "proves": "The 401 line, 'glab: Invalid token' and the permission sentence give Lost::Login; '404 Project Not Found' and NO_PROJECT give Lost::Project; 404, 403, timeout, look-alikes and \"\" give None. Kills the reason mutants."
    },
    {
      "name": "remembered::a_mutation_denied_after_a_logout_answers_not_logged_in",
      "proves": "On mr-remembered k=7 (anonymous, logged out), change_people and rerequest_review answer NotLoggedIn{gitlab.com}. The mutation runs once, then one more auth status; the project call runs once."
    },
    {
      "name": "people::a_top_level_error_fails_and_asks_whether_the_login_is_gone (was a_top_level_error_fails)",
      "proves": "The same sentence while logged in still replies Failed{DENIED}. The logged argv is exactly auth status, project, mutation, auth status (auth status decides)."
    }
  ],
  "smoke_evidence": [
    {
      "command": "M3 again: h=$(mktemp -d); jq -n '{text:\"x\", gfm:true, project:\"samubr/glab-yamt-playground\"}' | HOME=$h XDG_CONFIG_HOME=$h glab api --method POST markdown --input -; echo \"exit $?\"",
      "observed": "{\"message\":\"401 Unauthorized\"}glab: 401 Unauthorized (HTTP 401)\nexit 1. In that temp HOME, `glab auth status` showed 'Token found in operating system keyring' and a 401, so this glab was not truly token-less (README says so)."
    },
    {
      "command": "M4 GITLAB_TOKEN=glpat-yamt-invalid-token glab api --include graphql --input /tmp/m4.json (mergeRequestSetReviewers, samubr/glab-yamt-playground, iid 999999)",
      "observed": "HTTP/2.0 401 Unauthorized … {\"errors\":[{\"message\":\"Invalid token\"}]}glab: Invalid token\nexit 1 (the same with a temp HOME/XDG_CONFIG_HOME and DBUS unset: the keyring token was still found)"
    },
    {
      "command": "M6/M11 curl -X POST https://gitlab.com/api/graphql with no token, same mutation on the playground (iid 999999) and on gitlab-org/gitlab (iid 999999999)",
      "observed": "{\"errors\":[{\"message\":\"The resource that you are attempting to access does not exist or you don't have permission to perform this action\",…,\"path\":[\"changed\"]}],\"data\":{\"changed\":null}}\nHTTP 200 (both projects)"
    },
    {
      "command": "M8 glab api graphql --input /tmp/m4.json (logged in, iid 999999)",
      "observed": "same body; stderr 'glab: The resource that you are attempting to access does not exist or you don't have permission to perform this action'; exit 1"
    },
    {
      "command": "M7/M9/M12 curl with no token: POST …/samubr%2Fglab-yamt-playground/merge_requests/999999/notes; POST markdown for the playground and for gitlab-org/gitlab",
      "observed": "{\"message\":\"401 Unauthorized\"} HTTP 401 for all three. M10: an anonymous GraphQL read gives project:null for the playground (private: anonymous GET projects/… is 404) and data for gitlab-org/gitlab."
    },
    {
      "command": "cargo fmt --all --check; cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings",
      "observed": "FMT-OK; Finished `dev` profile … (no warnings)"
    },
    {
      "command": "env <hermetic_git> cargo nextest run -p yamt-merge-requests -p yamt-app -p yamt-gitio",
      "observed": "Summary [7.462s] 777 tests run: 777 passed, 59 skipped (includes lost_reads_glabs_words, a_mutation_denied_after_a_logout_answers_not_logged_in, a_top_level_error_fails_and_asks_whether_the_login_is_gone, refresh_asks_again, the logged-out/ tests and gitio runner/)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 17 mutants tested in 2m: 11 caught, 6 unviable, 0 missed",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Contract `fn is_lost(words) -> bool` is replaced by `fn lost(words) -> Option<Lost>` plus `enum Lost { Login, Project }` and a private `enum Forget { Refresh, Lost(Lost) }` for `Remembered::forget`, as findings #2448/#2454 ask. The acceptance test is renamed `is_lost_reads_glabs_words` → `lost_reads_glabs_words`.",
    "New `NO_PERMISSION` constant (GitLab's full sentence) counts as `Lost::Login`. A logged-in user on a missing or forbidden merge request gets the same sentence (M8), so that case now also forgets the project and runs one auth status; the reply is unchanged.",
    "Fake glab: new api-status line `anonymous`, modelled on the measured token-less answers. A GraphQL `--input -` call gets the denial in a 200 OK with `\"data\":null` (measured: `{\"changed\":null}`; the alias differs per mutation), stderr `glab: <denial>`, exit 1. Other POST/PUT calls answer 401; GET and GraphQL reads answer as usual.",
    "The note's M3 deviation ('anonymous preview works') is superseded: M3 and curl both answer 401. README lines 88–101 now record M3, M7, M9, M11, M12 and the mutation measurements.",
    "Brief Change step 1's 'truly logged-out config dir' was not reachable with glab here: a temp HOME/XDG_CONFIG_HOME (even with DBUS unset) still found a keyring token. Token-less answers were measured with curl, which is what glab sends without a token [INFERENCE].",
    "The rerequest.rs unit test's shorter sentence ('…does not exist', no permission clause) is left as is; it is not lost (pinned in the kept list)."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/project.rs:140 lost()",
      "risk": "NO_PERMISSION also comes for a logged-in reader's deleted or forbidden merge request, or a missing discussion in a mutation. Each such failure now costs one extra auth status and forgets the project, so the next action asks again."
    },
    {
      "location": "scripts/fake-glab/glab anonymous()",
      "risk": "No hermetic test runs the fake's `anonymous` POST-401 branch on its own (the hook blocks a temp state file). It is exercised only through the remembered.rs rerequest/change cases, which reach the GraphQL branches."
    }
  ]
}

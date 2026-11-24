#![cfg(test)]
#![cfg(unix)]

mod support;

use std::fs;
use std::sync::mpsc;

use serde_json::{Value, json};
use yamt_conflict_repo::git_ok;
use yamt_gitio::Glab;
use yamt_merge_core::{LeftLine, RightLine};
use yamt_review::{
    DiffLine, GitLabCheck, LookedAt, MergeRequestRef, NotLinedUp, Posting, SendProgress, SendReply,
    ThreadPlace, check_gitlab, send_queue,
};

use support::{
    ADDED_TEXT, Fake, REFUSAL, REMOVED_TEXT, RENAMED_TEXT, Review, SHORT_TIMEOUT, added,
    merge_request_12, note_of, pending, postings, progress, queued, range_of, range_repo,
    repo_root,
};

/// `scripts/range-repo.sh`'s commits, fixed by its names and dates.
const MERGE_BASE: &str = "531ea52dfb892e20206010fb6cd6161d9c88964a";
const MAIN: &str = "437805506eab02eaba409bdeffd00e0383476e35";
const FEATURE: &str = "9c1ba3fc606a3776061d23006b83e2af2a357112";
const POST_ARGV: &str =
    "argv: api --include --method POST projects/7/merge_requests/12/draft_notes --input -";
const BOARD: &str = "src/board/board.ts";
const IN_COLUMN_TEXT: &str = "Why a second reminder here?";
const BOTH_SIDES_TEXT: &str = "Why replace the limit check?";

impl Review {
    /// Two threads on `src/board/board.ts`, each first message queued: from the unchanged L197/R201 to the added
    /// R204 (in one column), then from the removed L200 to the added R204 (across both); 0-based below.
    fn ranges() -> Review {
        let in_column = ThreadPlace {
            start: DiffLine::Unchanged {
                left: LeftLine(196),
                right: RightLine(200),
            },
            end: added(203),
        };
        let both_sides = ThreadPlace {
            start: DiffLine::Removed {
                left: LeftLine(199),
            },
            end: added(203),
        };
        let threads = [
            (BOARD, in_column, IN_COLUMN_TEXT),
            (BOARD, both_sides, BOTH_SIDES_TEXT),
        ];
        Review::with_threads("main...feature", &threads)
    }

    fn send(&self, glab: &Glab) -> (SendReply, Vec<SendProgress>) {
        self.send_reacting(glab, &|_| {})
    }

    /// A send whose progress callback also runs `react`, as the user acting while the send runs.
    fn send_reacting(
        &self,
        glab: &Glab,
        react: &dyn Fn(SendProgress),
    ) -> (SendReply, Vec<SendProgress>) {
        let (sender, receiver) = mpsc::channel();
        let report = |step: SendProgress| {
            sender.send(step).unwrap();
            react(step);
        };
        let reply = send_queue(&self.range, Some(glab), &self.threads, &report).unwrap();
        (reply, receiver.try_iter().collect())
    }

    /// Adds `text` as a note to the thread at `index` and queues it with that text.
    fn add_queued_note(&self, index: usize, text: &str) {
        let mut store = self.threads.lock().unwrap();
        let thread = store.list(&self.range).threads[index].id;
        let list = store.add_note(&self.range, thread, text).unwrap();
        let note = list.threads[index].messages.last().unwrap().id;
        store.queue(&self.range, note, text).unwrap();
    }

    fn postings(&self) -> Vec<Posting> {
        let list = self.threads.lock().unwrap().list(&self.range);
        postings(&list)
    }
}

#[test]
fn range_repo_has_the_scenarios_commit_ids() {
    let repo = range_repo();
    let commit = |args: &[&str]| {
        let output = git_ok(&repo_root(&repo), args).unwrap();
        String::from_utf8(output).unwrap().trim_end().to_owned()
    };
    let found = [
        commit(&["merge-base", "main", "feature"]),
        commit(&["rev-parse", "main"]),
        commit(&["rev-parse", "feature"]),
    ];
    assert_eq!(
        found,
        [MERGE_BASE, MAIN, FEATURE],
        "scripts/range-repo.sh made other commits: tests/glab/* and these constants pin its ids"
    );
}

#[test]
fn sending_posts_in_thread_order_and_records_pending_with_the_link() {
    let review = Review::new();
    let fake = Fake::new("lined-up");

    let (reply, steps) = review.send(&fake.glab);

    let expected = vec![
        pending(ADDED_TEXT, 101),
        pending(RENAMED_TEXT, 102),
        pending(REMOVED_TEXT, 103),
    ];
    let SendReply::Sent {
        list,
        sent,
        refused,
    } = reply
    else {
        panic!("not sent: {reply:?}");
    };
    assert_eq!((sent, refused), (3, 0));
    assert_eq!(postings(&list), expected);
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1, 2, 3], 3));
    let notes: Vec<String> = fake
        .bodies()
        .iter()
        .map(|body| note_of(body).to_owned())
        .collect();
    assert_eq!(notes, [ADDED_TEXT, RENAMED_TEXT, REMOVED_TEXT]);
}

#[test]
fn the_post_body_names_the_three_commits_and_the_position() {
    let review = Review::new();
    let fake = Fake::new("lined-up");

    review.send(&fake.glab);

    let position = |old_path: &str, new_path: &str, lines: Value| {
        let mut position = json!({
            "position_type": "text",
            "base_sha": MERGE_BASE,
            "start_sha": MAIN,
            "head_sha": FEATURE,
            "old_path": old_path,
            "new_path": new_path,
        });
        position
            .as_object_mut()
            .unwrap()
            .extend(lines.as_object().unwrap().clone());
        position
    };
    let reminders = "src/board/reminders.ts";
    let mock_boards = "src/api/mockBoards.ts";
    let expected = [
        json!({ "note": ADDED_TEXT, "position": position(reminders, reminders, json!({ "new_line": 3 })) }),
        json!({ "note": RENAMED_TEXT, "position": position("docs/shortcuts.md", "docs/keys.md", json!({ "old_line": 1, "new_line": 1 })) }),
        json!({ "note": REMOVED_TEXT, "position": position(mock_boards, mock_boards, json!({ "old_line": 2 })) }),
    ];
    assert_eq!(fake.bodies(), expected);
    let posts = fake.argv().into_iter().filter(|argv| argv == POST_ARGV);
    assert_eq!(posts.count(), 3, "{}", fake.log());
}

#[test]
fn a_refused_message_keeps_its_reason_and_stays_queued_while_the_others_are_sent() {
    let review = Review::new();
    let fake = Fake::new("refusal");

    let (reply, steps) = review.send(&fake.glab);

    let refused = Posting::Refused {
        text: RENAMED_TEXT.to_owned(),
        reason: REFUSAL.to_owned(),
    };
    let expected = vec![
        pending(ADDED_TEXT, 101),
        refused,
        pending(REMOVED_TEXT, 103),
    ];
    let SendReply::Sent {
        list,
        sent,
        refused,
    } = reply
    else {
        panic!("not sent: {reply:?}");
    };
    assert_eq!((sent, refused), (2, 1));
    assert_eq!(postings(&list), expected);
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1, 2, 3], 3));
}

#[test]
fn a_timeout_stops_the_send_and_leaves_the_rest_queued() {
    let review = Review::new();
    let fake = Fake::new("timeout");
    let glab = Glab::at(fake.dir.path().join("glab")).with_timeout(SHORT_TIMEOUT);

    let (reply, steps) = review.send(&glab);

    let expected = vec![
        pending(ADDED_TEXT, 101),
        queued(RENAMED_TEXT),
        queued(REMOVED_TEXT),
    ];
    let SendReply::Stopped {
        list,
        sent,
        refused,
        reason,
    } = reply
    else {
        panic!("not stopped: {reply:?}");
    };
    assert_eq!((sent, refused, reason.as_str()), (1, 0, "glab timed out"));
    assert_eq!(postings(&list), expected);
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1], 3));
    let posts = fake.argv().into_iter().filter(|argv| argv == POST_ARGV);
    assert_eq!(posts.count(), 2, "{}", fake.log());
}

#[test]
fn a_message_already_among_the_drafts_is_recorded_without_posting_again() {
    let review = Review::new();
    let fake = Fake::new("drafted");

    let (reply, steps) = review.send(&fake.glab);

    let expected = vec![
        pending(ADDED_TEXT, 301),
        pending(RENAMED_TEXT, 303),
        pending(REMOVED_TEXT, 304),
    ];
    let SendReply::Sent {
        list,
        sent,
        refused,
    } = reply
    else {
        panic!("not sent: {reply:?}");
    };
    assert_eq!((sent, refused), (3, 0));
    assert_eq!(postings(&list), expected);
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1, 2, 3], 3));
    let notes: Vec<String> = fake
        .bodies()
        .iter()
        .map(|body| note_of(body).to_owned())
        .collect();
    assert_eq!(notes, [RENAMED_TEXT, REMOVED_TEXT]);
    let drafts_listed = "argv: api --paginate projects/7/merge_requests/12/draft_notes";
    assert!(
        fake.argv().iter().any(|argv| argv == drafts_listed),
        "{}",
        fake.log()
    );
}

#[test]
fn a_draft_a_pending_message_owns_never_stands_in_for_another_message() {
    let review = Review::new();
    let fake = Fake::new("drafted");
    review.send(&fake.glab);
    review.add_queued_note(0, ADDED_TEXT);

    let (reply, steps) = review.send(&fake.glab);

    let SendReply::Sent { sent: 1, .. } = reply else {
        panic!("not sent once: {reply:?}");
    };
    let expected = vec![
        pending(ADDED_TEXT, 301),
        pending(ADDED_TEXT, 305),
        pending(RENAMED_TEXT, 303),
        pending(REMOVED_TEXT, 304),
    ];
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1], 1));
    let notes: Vec<String> = fake
        .bodies()
        .iter()
        .map(|body| note_of(body).to_owned())
        .collect();
    assert_eq!(notes, [RENAMED_TEXT, REMOVED_TEXT, ADDED_TEXT]);
}

#[test]
fn a_message_unqueued_while_the_send_runs_is_neither_posted_nor_pending() {
    let review = Review::new();
    let fake = Fake::new("lined-up");
    let second = review.first_message(1);
    let unqueue_second = |step: SendProgress| {
        if step.done == 1 {
            let mut store = review.threads.lock().unwrap();
            store.unqueue(&review.range, second).unwrap();
        }
    };

    let (reply, steps) = review.send_reacting(&fake.glab, &unqueue_second);

    let expected = vec![
        pending(ADDED_TEXT, 101),
        Posting::NotQueued,
        pending(REMOVED_TEXT, 102),
    ];
    let SendReply::Sent { sent: 2, .. } = reply else {
        panic!("not sent twice: {reply:?}");
    };
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1, 2, 3], 3));
    let notes: Vec<String> = fake
        .bodies()
        .iter()
        .map(|body| note_of(body).to_owned())
        .collect();
    assert_eq!(notes, [ADDED_TEXT, REMOVED_TEXT]);
}

#[test]
fn a_message_edited_while_the_send_runs_is_posted_with_its_new_text() {
    const EDITED: &str = "Keep the old title, or name both?";
    let review = Review::new();
    let fake = Fake::new("lined-up");
    let second = review.first_message(1);
    let edit_second = |step: SendProgress| {
        if step.done == 1 {
            let mut store = review.threads.lock().unwrap();
            store.queue(&review.range, second, EDITED).unwrap();
        }
    };

    review.send_reacting(&fake.glab, &edit_second);

    let expected = vec![
        pending(ADDED_TEXT, 101),
        pending(EDITED, 102),
        pending(REMOVED_TEXT, 103),
    ];
    assert_eq!(review.postings_on_disk(), expected);
    let notes: Vec<String> = fake
        .bodies()
        .iter()
        .map(|body| note_of(body).to_owned())
        .collect();
    assert_eq!(notes, [ADDED_TEXT, EDITED, REMOVED_TEXT]);
}

#[test]
fn a_send_that_cannot_list_the_drafts_posts_nothing() {
    let review = Review::on(&format!("main...{FEATURE}"));
    let fake = Fake::new("commit-route");

    let (reply, steps) = review.send(&fake.glab);

    let SendReply::Stopped {
        sent,
        refused,
        reason,
        ..
    } = reply
    else {
        panic!("not stopped: {reply:?}");
    };
    assert_eq!(
        (sent, refused, reason.as_str()),
        (0, 0, "glab: 404 Not Found (HTTP 404)")
    );
    assert_eq!(steps, []);
    assert!(!fake.log().contains("stdin:"), "{}", fake.log());
    let unchanged = vec![
        queued(ADDED_TEXT),
        queued(RENAMED_TEXT),
        queued(REMOVED_TEXT),
    ];
    assert_eq!(review.postings(), unchanged);
    assert_eq!(review.postings_on_disk(), unchanged);
}

#[test]
fn send_rechecks_and_posts_nothing_when_the_merge_request_moved() {
    let review = Review::new();
    let fake = Fake::new("moved");

    let (reply, steps) = review.send(&fake.glab);

    let why = NotLinedUp::Moved {
        merge_request: merge_request_12(),
        gitlab_head: "d1e2f3a".to_owned(),
        shown_head: "9c1ba3f".to_owned(),
    };
    assert_eq!(reply, SendReply::NotLinedUp { why });
    assert_eq!(steps, []);
    assert_eq!(fake.bodies(), Vec::<Value>::new());
    assert!(!fake.log().contains("draft_notes"), "{}", fake.log());
    let unchanged = vec![
        queued(ADDED_TEXT),
        queued(RENAMED_TEXT),
        queued(REMOVED_TEXT),
    ];
    assert_eq!(review.postings(), unchanged);
    assert_eq!(review.postings_on_disk(), unchanged);
}

#[test]
fn glab_missing_and_logged_out_are_their_reasons() {
    let review = Review::new();
    let no_progress = |_: SendProgress| panic!("progress without glab");

    let missing = check_gitlab(&review.range, None);
    let sent_without = send_queue(&review.range, None, &review.threads, &no_progress).unwrap();
    let fake = Fake::new("logged-out");
    let logged_out = check_gitlab(&review.range, Some(&fake.glab));
    let sent_logged_out = send_queue(
        &review.range,
        Some(&fake.glab),
        &review.threads,
        &no_progress,
    )
    .unwrap();

    let why = NotLinedUp::GlabMissing;
    assert_eq!(missing, GitLabCheck::NotLinedUp { why: why.clone() });
    assert_eq!(sent_without, SendReply::NotLinedUp { why });
    let why = NotLinedUp::NotLoggedIn {
        detail: "gitlab.com".to_owned(),
    };
    assert_eq!(logged_out, GitLabCheck::NotLinedUp { why: why.clone() });
    assert_eq!(sent_logged_out, SendReply::NotLinedUp { why });
    assert_eq!(fake.argv(), ["argv: auth status", "argv: auth status"]);
}

#[test]
fn a_branch_side_asks_for_the_branch_s_open_merge_requests() {
    let repo = range_repo();
    git_ok(
        &repo_root(&repo),
        &["update-ref", "refs/remotes/origin/feature", "feature"],
    )
    .unwrap();
    let fake = Fake::new("lined-up");

    let by_branch = check_gitlab(&range_of(&repo, "main...feature"), Some(&fake.glab));
    let by_remote = check_gitlab(&range_of(&repo, "main...origin/feature"), Some(&fake.glab));

    let lined_up = GitLabCheck::LinedUp {
        merge_request: merge_request_12(),
    };
    assert_eq!((&by_branch, &by_remote), (&lined_up, &lined_up));
    let one_check = [
        "argv: auth status",
        "argv: api --method GET projects/:fullpath/merge_requests -f state=opened -f source_branch=feature",
        "argv: api projects/7/merge_requests/12",
    ];
    assert_eq!(fake.argv(), [one_check, one_check].concat());
    let cwd = format!(
        "cwd: {}",
        fs::canonicalize(repo_root(&repo)).unwrap().display()
    );
    assert!(
        fake.log()
            .lines()
            .all(|line| !line.starts_with("cwd: ") || line == cwd)
    );
}

#[test]
fn a_commit_id_side_asks_for_the_commit_s_merge_requests() {
    let repo = range_repo();
    let fake = Fake::new("commit-route");

    let checked = check_gitlab(
        &range_of(&repo, &format!("main...{FEATURE}")),
        Some(&fake.glab),
    );

    let lined_up = GitLabCheck::LinedUp {
        merge_request: merge_request_12(),
    };
    assert_eq!(checked, lined_up);
    let by_commit =
        format!("argv: api projects/:fullpath/repository/commits/{FEATURE}/merge_requests");
    let expected = [
        "argv: auth status",
        &by_commit,
        "argv: api projects/7/merge_requests/12",
    ];
    assert_eq!(fake.argv(), expected);
}

#[test]
fn several_line_up_as_the_one_that_matches_and_none_name_what_was_looked_at() {
    let repo = range_repo();
    let range = range_of(&repo, "main...feature");
    let several = Fake::new("several");
    let several_none = Fake::new("several-none");
    let none = Fake::new("no-merge-request");

    let fourteen = MergeRequestRef {
        reference: "!14".to_owned(),
        title: "Reminders before a card is due".to_owned(),
        web_url: "https://gitlab.example/taskboard/taskboard/-/merge_requests/14".to_owned(),
    };
    assert_eq!(
        check_gitlab(&range, Some(&several.glab)),
        GitLabCheck::LinedUp {
            merge_request: fourteen
        }
    );
    let feature = LookedAt::Branch {
        name: "feature".to_owned(),
    };
    let references = vec!["!12".to_owned(), "!14".to_owned()];
    let why = NotLinedUp::Several {
        looked_at: feature.clone(),
        references,
    };
    assert_eq!(
        check_gitlab(&range, Some(&several_none.glab)),
        GitLabCheck::NotLinedUp { why }
    );
    let why = NotLinedUp::NoMergeRequest { looked_at: feature };
    assert_eq!(
        check_gitlab(&range, Some(&none.glab)),
        GitLabCheck::NotLinedUp { why }
    );
}

/// The draft-notes body of a note on board.ts that ends on the added R204, with GitLab's `line_range`.
fn board_range_body(note: &str, line_range: &Value) -> Value {
    json!({
        "note": note,
        "position": {
            "position_type": "text",
            "base_sha": MERGE_BASE,
            "start_sha": MAIN,
            "head_sha": FEATURE,
            "old_path": BOARD,
            "new_path": BOARD,
            "new_line": 204,
            "line_range": line_range,
        },
    })
}

// The line codes' hash is `printf '%s' src/board/board.ts | sha1sum`, written out so the test does not share the
// code's hashing.
#[test]
fn a_range_posts_both_ends_with_gitlabs_line_codes() {
    let review = Review::ranges();
    let fake = Fake::new("line-range");

    let (reply, steps) = review.send(&fake.glab);

    let SendReply::Sent { sent: 2, .. } = reply else {
        panic!("not sent twice: {reply:?}");
    };
    assert_eq!(steps, progress(&[1, 2], 2));
    let added_end = json!({
        "line_code": "e783a9be490e9bcfa1e4a239bf6e62d2ab163459_201_204",
        "type": "new",
        "new_line": 204,
    });
    let in_column = json!({
        "start": {
            "line_code": "e783a9be490e9bcfa1e4a239bf6e62d2ab163459_197_201",
            "old_line": 197,
            "new_line": 201,
        },
        "end": added_end,
    });
    let both_sides = json!({
        "start": {
            "line_code": "e783a9be490e9bcfa1e4a239bf6e62d2ab163459_200_204",
            "type": "old",
            "old_line": 200,
        },
        "end": added_end,
    });
    let expected = [
        board_range_body(IN_COLUMN_TEXT, &in_column),
        board_range_body(BOTH_SIDES_TEXT, &both_sides),
    ];
    assert_eq!(fake.bodies(), expected);
    let posted = vec![pending(IN_COLUMN_TEXT, 201), pending(BOTH_SIDES_TEXT, 202)];
    assert_eq!(review.postings_on_disk(), posted);
}

#[test]
fn a_draft_stands_in_for_a_range_only_when_its_range_matches() {
    let review = Review::ranges();
    let fake = Fake::new("line-range-drafted");

    let (reply, _) = review.send(&fake.glab);

    let SendReply::Sent { sent: 2, .. } = reply else {
        panic!("not sent twice: {reply:?}");
    };
    let expected = vec![pending(IN_COLUMN_TEXT, 401), pending(BOTH_SIDES_TEXT, 501)];
    assert_eq!(review.postings_on_disk(), expected);
    let notes: Vec<String> = fake
        .bodies()
        .iter()
        .map(|body| note_of(body).to_owned())
        .collect();
    assert_eq!(notes, [BOTH_SIDES_TEXT]);
    let posts = fake.argv().into_iter().filter(|argv| argv == POST_ARGV);
    assert_eq!(posts.count(), 1, "{}", fake.log());
}

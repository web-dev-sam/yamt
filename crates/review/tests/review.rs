#![cfg(test)]
#![cfg(unix)]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, mpsc};
use std::time::Duration;

use serde_json::{Value, json};
use yamt_conflict_repo::{TempDir, git_ok};
use yamt_gitio::Glab;
use yamt_merge_core::{LeftLine, RightLine};
use yamt_range::{Range, RangeFileId, RangeSpec, Resolved};
use yamt_review::{
    GitLabCheck, LookedAt, MergeRequestRef, MessageId, NotLinedUp, Posting, SendProgress,
    SendReply, ThreadLine, ThreadList, ThreadStore, check_gitlab, send_queue,
};

/// `scripts/range-repo.sh`'s commits, fixed by its names and dates.
const MERGE_BASE: &str = "531ea52dfb892e20206010fb6cd6161d9c88964a";
const MAIN: &str = "437805506eab02eaba409bdeffd00e0383476e35";
const FEATURE: &str = "9c1ba3fc606a3776061d23006b83e2af2a357112";
const SHORT_TIMEOUT: Duration = Duration::from_secs(2);
const LINK: &str = "https://gitlab.example/taskboard/taskboard/-/merge_requests/12/diffs";
const ADDED_TEXT: &str = "Why not a Duration type?";
const RENAMED_TEXT: &str = "Keep the old title?";
const REMOVED_TEXT: &str = "Who still uses the mock boards?";
const REFUSAL: &str = r#"400 Bad request - Note {:line_code=>["can't be blank"]}"#;
const POST_ARGV: &str =
    "argv: api --include --method POST projects/7/merge_requests/12/draft_notes --input -";

fn in_this_repository(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(relative)
}

/// The range window's smoke repository, with its `main` and `feature`.
fn range_repo() -> TempDir {
    let dir = tempfile::tempdir().unwrap();
    let status = Command::new(in_this_repository("scripts/range-repo.sh"))
        .arg(dir.path().join("rr"))
        .output()
        .unwrap();
    assert!(status.status.success(), "{status:?}");
    dir
}

fn repo_root(repo: &TempDir) -> PathBuf {
    repo.path().join("rr")
}

fn range_of(repo: &TempDir, text: &str) -> Range {
    Resolved::resolve(&repo_root(repo), &RangeSpec::parse(text).unwrap())
        .unwrap()
        .list()
        .unwrap()
}

/// The fake glab on a scenario through a symlink beside its `glab.env`, never a file written here (ETXTBSY); the
/// post count and the log live beside it (`tests/glab/README.md`).
struct Fake {
    dir: TempDir,
    glab: Glab,
}

impl Fake {
    fn new(scenario: &str) -> Fake {
        let dir = tempfile::tempdir().unwrap();
        let settings = format!(
            "YAMT_FAKE_GLAB={}\nYAMT_FAKE_GLAB_STATE={}\nYAMT_FAKE_GLAB_LOG={}\n",
            in_this_repository(&format!("tests/glab/{scenario}")).display(),
            dir.path().join("state").display(),
            dir.path().join("log").display(),
        );
        fs::write(dir.path().join("glab.env"), settings).unwrap();
        let link = dir.path().join("glab");
        std::os::unix::fs::symlink(in_this_repository("scripts/fake-glab/glab"), &link).unwrap();
        Fake {
            glab: Glab::at(link),
            dir,
        }
    }

    fn log(&self) -> String {
        fs::read_to_string(self.dir.path().join("log")).unwrap_or_default()
    }

    fn argv(&self) -> Vec<String> {
        self.logged("argv: ")
    }

    /// Each posted body, parsed.
    fn bodies(&self) -> Vec<Value> {
        let bodies = self.logged("stdin: ");
        bodies
            .iter()
            .map(|body| serde_json::from_str(body.trim_start_matches("stdin: ")).unwrap())
            .collect()
    }

    fn logged(&self, prefix: &str) -> Vec<String> {
        let log = self.log();
        let lines = log.lines().filter(|line| line.starts_with(prefix));
        lines.map(str::to_owned).collect()
    }
}

/// A range `main...feature` with three threads, each first message queued: an added line of the added
/// `src/board/reminders.ts`, an unchanged line of the renamed `docs/keys.md`, a removed line of the deleted
/// `src/api/mockBoards.ts`, in that order.
struct Review {
    _repo: TempDir,
    pair: TempDir,
    range: Range,
    threads: Mutex<ThreadStore>,
}

impl Review {
    fn new() -> Review {
        Review::on("main...feature")
    }

    fn on(range_text: &str) -> Review {
        let repo = range_repo();
        let range = range_of(&repo, range_text);
        let pair = tempfile::tempdir().unwrap();
        let mut store = ThreadStore::open(pair.path()).unwrap();
        let threads = [
            ("src/board/reminders.ts", added(2), ADDED_TEXT),
            ("docs/keys.md", unchanged(0, 0), RENAMED_TEXT),
            ("src/api/mockBoards.ts", removed(1), REMOVED_TEXT),
        ];
        for (path, line, text) in threads {
            let added = store
                .add_thread(&range, file(&range, path), line, "first thought")
                .unwrap();
            let thread = added.list.threads.last().unwrap();
            store.queue(&range, thread.messages[0].id, text).unwrap();
        }
        Review {
            _repo: repo,
            pair,
            range,
            threads: Mutex::new(store),
        }
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

    /// The first message of the thread at `index` in creation order.
    fn first_message(&self, index: usize) -> MessageId {
        let list = self.threads.lock().unwrap().list(&self.range);
        list.threads[index].messages[0].id
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

    fn postings_on_disk(&self) -> Vec<Posting> {
        let reopened = ThreadStore::open(self.pair.path()).unwrap();
        postings(&reopened.list(&self.range))
    }
}

fn postings(list: &ThreadList) -> Vec<Posting> {
    let messages = list.threads.iter().flat_map(|thread| &thread.messages);
    messages.map(|message| message.posting.clone()).collect()
}

fn file(range: &Range, path: &str) -> RangeFileId {
    let entry = range.entries().iter().find(|entry| entry.path == path);
    entry.unwrap().id
}

fn added(right: u32) -> ThreadLine {
    ThreadLine::Added {
        right: RightLine(right),
    }
}

fn removed(left: u32) -> ThreadLine {
    ThreadLine::Removed {
        left: LeftLine(left),
    }
}

fn unchanged(left: u32, right: u32) -> ThreadLine {
    ThreadLine::UnchangedOnRight {
        left: LeftLine(left),
        right: RightLine(right),
    }
}

fn queued(text: &str) -> Posting {
    Posting::Queued {
        text: text.to_owned(),
    }
}

fn pending(text: &str, draft_note: u64) -> Posting {
    Posting::Pending {
        text: text.to_owned(),
        draft_note,
        merge_request: "!12".to_owned(),
        link: LINK.to_owned(),
    }
}

fn progress(steps: &[u32], of: u32) -> Vec<SendProgress> {
    steps
        .iter()
        .map(|&done| SendProgress { done, of })
        .collect()
}

fn note_of(body: &Value) -> &str {
    body["note"].as_str().unwrap()
}

fn merge_request_12() -> MergeRequestRef {
    MergeRequestRef {
        reference: "!12".to_owned(),
        title: "Reminders before a card is due".to_owned(),
        web_url: "https://gitlab.example/taskboard/taskboard/-/merge_requests/12".to_owned(),
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
        &["remote", "add", "origin", "https://gitlab.example/t.git"],
    )
    .unwrap();
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

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;

use serde_json::Value;
use yamt_conflict_repo::TempDir;
use yamt_gitio::Glab;
use yamt_merge_core::{LeftLine, RightLine};
use yamt_range::{Range, RangeFileId, RangeSpec, Resolved};
use yamt_review::{
    MergeRequestRef, MessageId, Posting, SendProgress, ThreadLine, ThreadList, ThreadPlace,
    ThreadStore,
};

pub const SHORT_TIMEOUT: Duration = Duration::from_secs(2);
pub const LINK: &str = "https://gitlab.example/taskboard/taskboard/-/merge_requests/12/diffs";
pub const ADDED_TEXT: &str = "Why not a Duration type?";
pub const RENAMED_TEXT: &str = "Keep the old title?";
pub const REMOVED_TEXT: &str = "Who still uses the mock boards?";
pub const REFUSAL: &str = r#"400 Bad request - Note {:line_code=>["can't be blank"]}"#;

fn in_this_repository(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(relative)
}

/// The range window's smoke repository, with its `main` and `feature`.
pub fn range_repo() -> TempDir {
    let dir = tempfile::tempdir().unwrap();
    let status = Command::new(in_this_repository("scripts/range-repo.sh"))
        .arg(dir.path().join("rr"))
        .output()
        .unwrap();
    assert!(status.status.success(), "{status:?}");
    dir
}

pub fn repo_root(repo: &TempDir) -> PathBuf {
    repo.path().join("rr")
}

pub fn range_of(repo: &TempDir, text: &str) -> Range {
    Resolved::resolve(&repo_root(repo), &RangeSpec::parse(text).unwrap())
        .unwrap()
        .list()
        .unwrap()
}

/// The fake glab on a scenario through a symlink beside its `glab.env`, never a file written here (ETXTBSY); the
/// post count and the log live beside it (`tests/glab/README.md`).
pub struct Fake {
    pub dir: TempDir,
    pub glab: Glab,
}

impl Fake {
    pub fn new(scenario: &str) -> Fake {
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

    pub fn log(&self) -> String {
        fs::read_to_string(self.dir.path().join("log")).unwrap_or_default()
    }

    pub fn argv(&self) -> Vec<String> {
        self.logged("argv: ")
    }

    /// Each posted body, parsed.
    pub fn bodies(&self) -> Vec<Value> {
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
pub struct Review {
    pub _repo: TempDir,
    pub pair: TempDir,
    pub range: Range,
    pub threads: Mutex<ThreadStore>,
}

impl Review {
    pub fn new() -> Review {
        Review::on("main...feature")
    }

    pub fn on(range_text: &str) -> Review {
        let threads = [
            (
                "src/board/reminders.ts",
                ThreadPlace::one_line(added(2)),
                ADDED_TEXT,
            ),
            (
                "docs/keys.md",
                ThreadPlace::one_line(unchanged(0, 0)),
                RENAMED_TEXT,
            ),
            (
                "src/api/mockBoards.ts",
                ThreadPlace::one_line(removed(1)),
                REMOVED_TEXT,
            ),
        ];
        Review::with_threads(range_text, &threads)
    }

    /// A thread per `(path, place, text)`, its first message queued with `text`.
    pub fn with_threads(range_text: &str, threads: &[(&str, ThreadPlace, &str)]) -> Review {
        let repo = range_repo();
        let range = range_of(&repo, range_text);
        let pair = tempfile::tempdir().unwrap();
        let mut store = ThreadStore::open(pair.path()).unwrap();
        for &(path, place, text) in threads {
            let added = store
                .add_thread(&range, file(&range, path), place, "first thought")
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

    /// The first message of the thread at `index` in creation order.
    pub fn first_message(&self, index: usize) -> MessageId {
        let list = self.threads.lock().unwrap().list(&self.range);
        list.threads[index].messages[0].id
    }

    pub fn postings_on_disk(&self) -> Vec<Posting> {
        let reopened = ThreadStore::open(self.pair.path()).unwrap();
        postings(&reopened.list(&self.range))
    }
}

pub fn postings(list: &ThreadList) -> Vec<Posting> {
    let messages = list.threads.iter().flat_map(|thread| &thread.messages);
    messages.map(|message| message.posting.clone()).collect()
}

fn file(range: &Range, path: &str) -> RangeFileId {
    let entry = range.entries().iter().find(|entry| entry.path == path);
    entry.unwrap().id
}

pub fn added(right: u32) -> ThreadLine {
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

pub fn queued(text: &str) -> Posting {
    Posting::Queued {
        text: text.to_owned(),
    }
}

pub fn pending(text: &str, draft_note: u64) -> Posting {
    Posting::Pending {
        text: text.to_owned(),
        draft_note,
        merge_request: "!12".to_owned(),
        link: LINK.to_owned(),
    }
}

pub fn progress(steps: &[u32], of: u32) -> Vec<SendProgress> {
    steps
        .iter()
        .map(|&done| SendProgress { done, of })
        .collect()
}

pub fn note_of(body: &Value) -> &str {
    body["note"].as_str().unwrap()
}

pub fn merge_request_12() -> MergeRequestRef {
    MergeRequestRef {
        reference: "!12".to_owned(),
        title: "Reminders before a card is due".to_owned(),
        web_url: "https://gitlab.example/taskboard/taskboard/-/merge_requests/12".to_owned(),
    }
}

use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_merge_core::{LeftLine, RightLine};
use yamt_range::RangeFileId;

/// A thread's identity; ids never repeat within a pair folder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct ThreadId(pub u32);

/// A message's identity; ids never repeat within a pair folder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct MessageId(pub u32);

/// The line a thread is on; the variant decides the column that shows it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ThreadLine {
    /// A left line inside a difference.
    Removed {
        /// The line.
        left: LeftLine,
    },
    /// A right line inside a difference.
    Added {
        /// The line.
        right: RightLine,
    },
    /// An unchanged line, shown in the left column.
    UnchangedOnLeft {
        /// The line in the left text.
        left: LeftLine,
        /// The same line in the right text.
        right: RightLine,
    },
    /// An unchanged line, shown in the right column.
    UnchangedOnRight {
        /// The line in the left text.
        left: LeftLine,
        /// The same line in the right text.
        right: RightLine,
    },
}

impl ThreadLine {
    /// The line without the column it is shown in.
    #[must_use]
    pub fn diff_line(self) -> DiffLine {
        match self {
            ThreadLine::Removed { left } => DiffLine::Removed { left },
            ThreadLine::Added { right } => DiffLine::Added { right },
            ThreadLine::UnchangedOnLeft { left, right }
            | ThreadLine::UnchangedOnRight { left, right } => DiffLine::Unchanged { left, right },
        }
    }
}

/// A line of the diff as GitLab's one-column view lists it: an unchanged line once, a change's removed lines, then its
/// added lines.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiffLine {
    /// A left line inside a difference.
    Removed {
        /// The line.
        left: LeftLine,
    },
    /// A right line inside a difference.
    Added {
        /// The line.
        right: RightLine,
    },
    /// An unchanged line.
    Unchanged {
        /// The line in the left text.
        left: LeftLine,
        /// The same line in the right text.
        right: RightLine,
    },
}

impl DiffLine {
    pub(crate) fn left(self) -> Option<LeftLine> {
        match self {
            DiffLine::Removed { left } | DiffLine::Unchanged { left, .. } => Some(left),
            DiffLine::Added { .. } => None,
        }
    }

    pub(crate) fn right(self) -> Option<RightLine> {
        match self {
            DiffLine::Added { right } | DiffLine::Unchanged { right, .. } => Some(right),
            DiffLine::Removed { .. } => None,
        }
    }
}

/// The lines a thread is on, from `start` to `end` in GitLab's order, both included; one line when `start` is `end`'s
/// line. `end` decides the column the box sits in.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct ThreadPlace {
    /// The first line.
    pub start: DiffLine,
    /// The last line, in the column it was picked in.
    pub end: ThreadLine,
}

impl ThreadPlace {
    /// The place of one line.
    #[must_use]
    pub fn one_line(line: ThreadLine) -> ThreadPlace {
        ThreadPlace {
            start: line.diff_line(),
            end: line,
        }
    }

    /// Whether the place holds only its end line.
    #[must_use]
    pub fn is_one_line(self) -> bool {
        self.start == self.end.diff_line()
    }

    /// Where both ends have a left line, start's is not after end's; the same for right lines.
    #[must_use]
    pub fn runs_forward(self) -> bool {
        let end = self.end.diff_line();
        let left_forward = match (self.start.left(), end.left()) {
            (Some(start), Some(end)) => start <= end,
            (None, _) | (_, None) => true,
        };
        let right_forward = match (self.start.right(), end.right()) {
            (Some(start), Some(end)) => start <= end,
            (None, _) | (_, None) => true,
        };
        left_forward && right_forward
    }
}

/// What a message says.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MessageBody {
    /// Text the user wrote.
    Note {
        /// The text as written.
        text: String,
    },
    /// An AI answer, kept in the AI's own session.
    AiAnswer {
        /// The session the answer lives in.
        session: String,
        /// The answer's turn among that session's answers in the thread, from 0.
        turn: u32,
    },
}

/// Where a message stands on its way to GitLab.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Posting {
    /// Not meant for GitLab.
    NotQueued,
    /// Waiting for the next send.
    Queued {
        /// The text to post, as edited.
        text: String,
    },
    /// GitLab refused it; it is sent again with the next send.
    Refused {
        /// The text to post, as edited.
        text: String,
        /// GitLab's words.
        reason: String,
    },
    /// Posted as a draft note of the user's pending review.
    Pending {
        /// The text posted.
        text: String,
        /// GitLab's id of the draft note.
        #[specta(type = u32)]
        draft_note: u64,
        /// The merge request's reference, "!12".
        merge_request: String,
        /// The merge request's Changes page.
        link: String,
    },
}

/// One message of a thread.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct Message {
    /// The message's id.
    pub id: MessageId,
    /// What it says.
    pub body: MessageBody,
    /// When it was added, in seconds since 1970.
    #[specta(type = u32)]
    pub written: u64,
    /// Where it stands on its way to GitLab.
    pub posting: Posting,
}

/// A thread on lines of one file of the range.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct Thread {
    /// The thread's id.
    pub id: ThreadId,
    /// The file it is on.
    pub file: RangeFileId,
    /// The lines it is on.
    pub place: ThreadPlace,
    /// Its messages in the order they were added; never empty.
    pub messages: Vec<Message>,
    /// The AI session the thread's answers live in.
    pub session: Option<String>,
}

/// Every thread on a file of the range, in the order they were made.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct ThreadList {
    /// The threads.
    pub threads: Vec<Thread>,
}

/// A new thread's id, and the threads with it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct ThreadAdded {
    /// The new thread.
    pub thread: ThreadId,
    /// Every thread, the new one last.
    pub list: ThreadList,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unchanged(left: u32, right: u32) -> DiffLine {
        DiffLine::Unchanged {
            left: LeftLine(left),
            right: RightLine(right),
        }
    }

    fn removed(left: u32) -> DiffLine {
        DiffLine::Removed {
            left: LeftLine(left),
        }
    }

    fn added(right: u32) -> ThreadLine {
        ThreadLine::Added {
            right: RightLine(right),
        }
    }

    fn removed_end(left: u32) -> ThreadLine {
        ThreadLine::Removed {
            left: LeftLine(left),
        }
    }

    fn on_left(left: u32, right: u32) -> ThreadLine {
        ThreadLine::UnchangedOnLeft {
            left: LeftLine(left),
            right: RightLine(right),
        }
    }

    fn place(start: DiffLine, end: ThreadLine) -> ThreadPlace {
        ThreadPlace { start, end }
    }

    #[test]
    fn one_line_places_run_forward_and_are_one_line() {
        let on_right = ThreadLine::UnchangedOnRight {
            left: LeftLine(4),
            right: RightLine(6),
        };
        for line in [added(3), removed_end(2), on_left(4, 6), on_right] {
            let one = ThreadPlace::one_line(line);
            assert_eq!(one.end, line);
            assert!(one.is_one_line(), "{one:?}");
            assert!(one.runs_forward(), "{one:?}");
        }
        assert_eq!(ThreadPlace::one_line(on_right).start, unchanged(4, 6));
        assert!(!place(unchanged(3, 5), on_left(4, 6)).is_one_line());
    }

    #[test]
    fn a_start_before_its_end_on_the_left_or_on_the_right_runs_forward() {
        assert!(place(removed(2), removed_end(5)).runs_forward());
        assert!(place(unchanged(2, 4), on_left(5, 7)).runs_forward());
        assert!(place(unchanged(2, 4), added(7)).runs_forward());
        assert!(place(unchanged(5, 7), on_left(5, 7)).runs_forward());
    }

    #[test]
    fn a_start_after_its_end_on_either_side_does_not_run_forward() {
        assert!(!place(removed(6), removed_end(5)).runs_forward());
        assert!(!place(unchanged(6, 4), on_left(5, 7)).runs_forward());
        assert!(!place(unchanged(2, 8), added(7)).runs_forward());
        assert!(!place(unchanged(5, 8), on_left(5, 7)).runs_forward());
    }

    // A start and an end with no side in common (an added start and a removed end, or a removed start in a later
    // difference than its added end) are not ordered here: only the differences tell, and the editor orders by them.
    #[test]
    fn a_start_and_an_end_with_no_side_in_common_run_forward_unseen() {
        let start = DiffLine::Added {
            right: RightLine(9),
        };
        assert!(place(start, removed_end(1)).runs_forward());
        assert!(place(removed(40), added(2)).runs_forward());
    }
}

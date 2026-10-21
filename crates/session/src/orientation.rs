use yamt_gitio::{Operation, Rebase, Stop};

use crate::sides::Side;

/// One of git's two sides of a conflict: index stage 2 (ours, HEAD) or 3 (theirs). Never a pane.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GitSide {
    Ours,
    Theirs,
}

/// Which git side the left pane (Local) shows; the right pane shows the other (plan §2 #86).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Orientation {
    left: GitSide,
}

impl Orientation {
    /// Own work on the left: a rebase replays the user's commits as git's theirs onto HEAD.
    pub(crate) fn of(stop: &Stop) -> Orientation {
        let left = match &stop.operation {
            Some(Operation::Rebase(Rebase {
                redoing_merge: None,
                ..
            })) => GitSide::Theirs,
            Some(
                Operation::Rebase(Rebase {
                    redoing_merge: Some(_),
                    ..
                })
                | Operation::Merge { .. }
                | Operation::SquashMerge { .. }
                | Operation::CherryPick { .. }
                | Operation::Revert { .. }
                | Operation::Am { .. },
            )
            | None => GitSide::Ours,
        };
        Orientation { left }
    }

    pub(crate) fn git_side(self, pane: Side) -> GitSide {
        match (pane, self.left) {
            (Side::Local, left) => left,
            (Side::Remote, GitSide::Ours) => GitSide::Theirs,
            (Side::Remote, GitSide::Theirs) => GitSide::Ours,
        }
    }

    pub(crate) fn pane(self, side: GitSide) -> Side {
        if side == self.left {
            Side::Local
        } else {
            Side::Remote
        }
    }

    /// `ours` and `theirs` as (left, right).
    pub(crate) fn panes<T>(self, ours: T, theirs: T) -> (T, T) {
        match self.left {
            GitSide::Ours => (ours, theirs),
            GitSide::Theirs => (theirs, ours),
        }
    }
}

#[cfg(test)]
pub(crate) const OURS_LEFT: Orientation = Orientation {
    left: GitSide::Ours,
};

#[cfg(test)]
pub(crate) const THEIRS_LEFT: Orientation = Orientation {
    left: GitSide::Theirs,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_pane_and_its_git_side_map_back_to_each_other_in_both_orientations() {
        for orientation in [OURS_LEFT, THEIRS_LEFT] {
            for pane in [Side::Local, Side::Remote] {
                assert_eq!(orientation.pane(orientation.git_side(pane)), pane);
            }
        }
        assert_eq!(THEIRS_LEFT.git_side(Side::Local), GitSide::Theirs);
        assert_eq!(THEIRS_LEFT.git_side(Side::Remote), GitSide::Ours);
        assert_eq!(OURS_LEFT.git_side(Side::Remote), GitSide::Theirs);
        assert_eq!(THEIRS_LEFT.panes("ours", "theirs"), ("theirs", "ours"));
        assert_eq!(OURS_LEFT.panes("ours", "theirs"), ("ours", "theirs"));
    }
}

use std::path::Path;

use yamt_gitio::{Changed, ChangedFile, Numstat, Oid, TreeSide};

use crate::{RangeChange, RangeEntry, RangeEntryKind, RangeFileId, RangeLineCounts};

const EXECUTABLE_MODE: u32 = 0o100_755;
const LINK_MODE: u32 = 0o120_000;
const GITLINK_MODE: u32 = 0o160_000;

/// A changed file as the range holds it: its row, and both sides' blobs as listed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct FileAt {
    pub(crate) entry: RangeEntry,
    pub(crate) old: Option<BlobAt>,
    pub(crate) new: Option<BlobAt>,
    pub(crate) binary: bool,
}

/// One side's object: `size` is `None` for a gitlink, whose id names a commit, not a blob.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct BlobAt {
    pub(crate) oid: Oid,
    pub(crate) mode: u32,
    pub(crate) size: Option<u64>,
}

impl BlobAt {
    pub(crate) fn kind(&self) -> RangeEntryKind {
        match self.mode {
            LINK_MODE => RangeEntryKind::Link,
            GITLINK_MODE => RangeEntryKind::Submodule,
            EXECUTABLE_MODE => RangeEntryKind::Executable,
            _ => RangeEntryKind::File,
        }
    }

    pub(crate) fn is_gitlink(&self) -> bool {
        self.mode == GITLINK_MODE
    }
}

pub(crate) fn sort_by_display_path(changed: &mut [ChangedFile]) {
    changed.sort_by_cached_key(|file| display_path(&file.change));
}

/// Every side's object id but a gitlink's, in list order: the ids `files_at` takes the sizes of.
pub(crate) fn blob_ids(changed: &[ChangedFile]) -> Vec<Oid> {
    let mut ids = Vec::new();
    for file in changed {
        let (old, new) = sides(&file.change);
        for side in [old, new].into_iter().flatten() {
            if side.mode != GITLINK_MODE {
                ids.push(side.oid.clone());
            }
        }
    }
    ids
}

/// One `FileAt` per changed file, ids in list order; `sizes` answer `blob_ids(&changed)` in its order.
pub(crate) fn files_at(changed: Vec<ChangedFile>, sizes: Vec<Option<u64>>) -> Vec<FileAt> {
    let mut sizes = sizes.into_iter();
    let mut files = Vec::with_capacity(changed.len());
    for (id, file) in (0..).zip(changed) {
        let (old, new) = sides(&file.change);
        let old = old.map(|side| blob_at(side, &mut sizes));
        let new = new.map(|side| blob_at(side, &mut sizes));
        files.push(FileAt {
            entry: RangeEntry {
                id: RangeFileId(id),
                path: display_path(&file.change),
                change: range_change(&file.change),
                lines: line_counts(file.numstat),
            },
            old,
            new,
            binary: file.numstat == Numstat::Binary,
        });
    }
    files
}

fn blob_at(tree_side: &TreeSide, sizes: &mut impl Iterator<Item = Option<u64>>) -> BlobAt {
    let size = if tree_side.mode == GITLINK_MODE {
        None
    } else {
        sizes.next().flatten()
    };
    BlobAt {
        oid: tree_side.oid.clone(),
        mode: tree_side.mode,
        size,
    }
}

fn sides(change: &Changed) -> (Option<&TreeSide>, Option<&TreeSide>) {
    match change {
        Changed::Added { new } => (None, Some(new)),
        Changed::Deleted { old } => (Some(old), None),
        Changed::Modified { old, new } | Changed::Renamed { old, new } => (Some(old), Some(new)),
    }
}

fn display_path(change: &Changed) -> String {
    match change {
        Changed::Added { new } | Changed::Modified { new, .. } | Changed::Renamed { new, .. } => {
            display(&new.path)
        }
        Changed::Deleted { old } => display(&old.path),
    }
}

fn range_change(change: &Changed) -> RangeChange {
    match change {
        Changed::Added { .. } => RangeChange::Added,
        Changed::Modified { .. } => RangeChange::Modified,
        Changed::Deleted { .. } => RangeChange::Deleted,
        Changed::Renamed { old, .. } => RangeChange::Renamed {
            old_path: display(&old.path),
        },
    }
}

fn line_counts(numstat: Numstat) -> RangeLineCounts {
    match numstat {
        Numstat::Lines { added, removed } => RangeLineCounts::Counted { added, removed },
        Numstat::Binary | Numstat::Missing => RangeLineCounts::NotCounted,
    }
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    const REGULAR_MODE: u32 = 0o100_644;
    const FIRST: &str = "1111111111111111111111111111111111111111";
    const SECOND: &str = "2222222222222222222222222222222222222222";
    const THIRD: &str = "3333333333333333333333333333333333333333";

    fn side(path: &str, mode: u32, hex: &str) -> TreeSide {
        TreeSide {
            path: PathBuf::from(path),
            mode,
            oid: oid(hex),
        }
    }

    fn oid(hex: &str) -> Oid {
        Oid::parse(hex).unwrap()
    }

    fn blob(hex: &str, mode: u32, size: Option<u64>) -> BlobAt {
        BlobAt {
            oid: oid(hex),
            mode,
            size,
        }
    }

    fn listed(change: Changed, numstat: Numstat) -> ChangedFile {
        ChangedFile { change, numstat }
    }

    fn listing() -> Vec<ChangedFile> {
        vec![
            listed(
                Changed::Modified {
                    old: side("z.txt", REGULAR_MODE, FIRST),
                    new: side("z.txt", EXECUTABLE_MODE, SECOND),
                },
                Numstat::Lines {
                    added: 2,
                    removed: 1,
                },
            ),
            listed(
                Changed::Deleted {
                    old: side("m/gone.txt", REGULAR_MODE, THIRD),
                },
                Numstat::Binary,
            ),
            listed(
                Changed::Renamed {
                    old: side("y/old.txt", REGULAR_MODE, FIRST),
                    new: side("b/new.txt", REGULAR_MODE, SECOND),
                },
                Numstat::Missing,
            ),
            listed(
                Changed::Added {
                    new: side("a/lib", GITLINK_MODE, THIRD),
                },
                Numstat::Lines {
                    added: 1,
                    removed: 0,
                },
            ),
        ]
    }

    #[test]
    fn rows_are_sorted_by_path_and_a_deleted_row_is_named_by_its_old_path() {
        let mut changed = listing();
        sort_by_display_path(&mut changed);
        let entries: Vec<RangeEntry> = files_at(changed, vec![Some(1); 4])
            .into_iter()
            .map(|file| file.entry)
            .collect();

        let entry = |id, path: &str, change, lines| RangeEntry {
            id: RangeFileId(id),
            path: path.to_owned(),
            change,
            lines,
        };
        let renamed = RangeChange::Renamed {
            old_path: "y/old.txt".to_owned(),
        };
        let counted = |added, removed| RangeLineCounts::Counted { added, removed };
        let expected = vec![
            entry(0, "a/lib", RangeChange::Added, counted(1, 0)),
            entry(1, "b/new.txt", renamed, RangeLineCounts::NotCounted),
            entry(
                2,
                "m/gone.txt",
                RangeChange::Deleted,
                RangeLineCounts::NotCounted,
            ),
            entry(3, "z.txt", RangeChange::Modified, counted(2, 1)),
        ];
        assert_eq!(entries, expected);
    }

    #[test]
    fn sizes_go_to_the_sides_in_blob_id_order_and_never_to_a_gitlink() {
        let mut changed = listing();
        sort_by_display_path(&mut changed);
        let ids = blob_ids(&changed);
        assert_eq!(ids, [FIRST, SECOND, THIRD, FIRST, SECOND].map(oid));

        let files = files_at(changed, vec![Some(10), Some(20), Some(30), None, Some(50)]);

        let blobs: Vec<(Option<BlobAt>, Option<BlobAt>, bool)> = files
            .into_iter()
            .map(|file| (file.old, file.new, file.binary))
            .collect();
        let expected = vec![
            (None, Some(blob(THIRD, GITLINK_MODE, None)), false),
            (
                Some(blob(FIRST, REGULAR_MODE, Some(10))),
                Some(blob(SECOND, REGULAR_MODE, Some(20))),
                false,
            ),
            (Some(blob(THIRD, REGULAR_MODE, Some(30))), None, true),
            (
                Some(blob(FIRST, REGULAR_MODE, None)),
                Some(blob(SECOND, EXECUTABLE_MODE, Some(50))),
                false,
            ),
        ];
        assert_eq!(blobs, expected);
    }

    #[test]
    fn a_mode_names_its_kind() {
        let kind = |mode| blob(FIRST, mode, None).kind();
        assert_eq!(kind(REGULAR_MODE), RangeEntryKind::File);
        assert_eq!(kind(EXECUTABLE_MODE), RangeEntryKind::Executable);
        assert_eq!(kind(LINK_MODE), RangeEntryKind::Link);
        assert_eq!(kind(GITLINK_MODE), RangeEntryKind::Submodule);
    }
}

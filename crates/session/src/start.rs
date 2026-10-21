use std::path::{Path, PathBuf};
use std::time::Instant;

use yamt_gitio::{
    AttributeValue, BlobReader, GitVersion, MergeAttributes, MergeConfig, MergeFileOptions, Oid,
    Repo, StageEntry,
};

use crate::Result;
use crate::decode::is_binary;
use crate::disk::OnDisk;
use crate::markers::{DEFAULT_MARKER_SIZE, Piece, open_regions, parse, split_lines, views};
use crate::scratch::ScratchDir;
use crate::session::LOG_TARGET;
use crate::sides::{SUBMODULE_MODE, SYMLINK_MODE};
use crate::stages::CapturedStages;

// merge-ort merges with histogram (merge-ort.c `DIFF_WITH_ALG(opt, HISTOGRAM_DIFF)`); `git merge-file`
// has `--diff-algorithm` since 2.44 (git-merge-file(1)).
const HISTOGRAM_SINCE: GitVersion = GitVersion {
    major: 2,
    minor: 44,
};

/// The gitattributes that decide what git wrote to a conflicted path.
pub(crate) struct Attributes {
    pub(crate) marker_size: usize,
    pub(crate) driver: MergeDriver,
    /// `working-tree-encoding` is set: the worktree bytes are not the blob's encoding.
    pub(crate) encoded: bool,
}

/// The driver git used, resolved from the attribute and the merge config (`merge_driver`).
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum MergeDriver {
    Text,
    Union,
    /// `-merge`, `merge=binary` or `merge.default=binary`: git keeps ours.
    Binary,
    /// A `merge.<name>.driver` from the config: what it wrote cannot be known.
    Custom,
}

/// One conflicted path as `open()` found it, before its stages are decoded.
pub(crate) struct StartFile<'a> {
    pub(crate) path: &'a Path,
    pub(crate) stages: &'a CapturedStages,
    /// base, ours and theirs bytes, in git's order, of a regular file with at least one side.
    pub(crate) sides: Option<&'a [Vec<u8>; 3]>,
    pub(crate) attributes: &'a Attributes,
    pub(crate) disk: &'a OnDisk,
}

/// The result of comparing one path with what git wrote; `BlobOf` is decided in one batch.
pub(crate) enum StartLook {
    Untouched,
    Changed,
    /// Untouched when the worktree file, cleaned by git, hashes to this blob.
    BlobOf(Oid),
    /// rerere replayed a resolution over git's merge output (plan §2 #90).
    Remembered {
        git_output: Vec<u8>,
    },
}

/// What open found for a path, once every `BlobOf` is hashed.
pub(crate) enum Found {
    Untouched,
    Changed,
    Remembered { git_output: Vec<u8> },
}

enum GitWrote<'a> {
    Merged {
        sides: &'a [Vec<u8>; 3],
        union: bool,
    },
    Stage(&'a StageEntry),
    Nothing,
    Unknown,
    NotWritten,
}

/// The start-up comparison of every conflicted path with what git wrote to it.
pub(crate) struct StartCheck<'r> {
    repo: &'r Repo,
    scratch: Option<ScratchDir>,
    histogram: Option<bool>,
    rerere: RerereTracked,
    merge_file_runs: u32,
    started: Instant,
}

/// The paths rerere tracks at this stop, read once, when the first file looks resolved at open.
enum RerereTracked {
    NotRead,
    /// rerere is not enabled, or recorded nothing at this stop.
    Off,
    Paths(Vec<PathBuf>),
    /// rerere may be enabled, but what it tracks could not be read: any path may have been replayed.
    Unknown,
}

impl Attributes {
    pub(crate) fn from_git(found: &MergeAttributes, config: &MergeConfig) -> Attributes {
        let marker_size = match &found.conflict_marker_size {
            AttributeValue::Value(value) => std::str::from_utf8(value)
                .ok()
                .and_then(|text| text.parse().ok())
                .filter(|&size| size > 0)
                .unwrap_or(DEFAULT_MARKER_SIZE),
            AttributeValue::Unspecified | AttributeValue::Unset | AttributeValue::Set => {
                DEFAULT_MARKER_SIZE
            }
        };
        let driver = merge_driver(&found.merge, config);
        let encoded = match &found.working_tree_encoding {
            AttributeValue::Value(_) => true,
            AttributeValue::Unspecified | AttributeValue::Unset | AttributeValue::Set => false,
        };
        Attributes {
            marker_size,
            driver,
            encoded,
        }
    }
}

// merge-ll.c `find_ll_merge_driver`: an unspecified attribute takes `merge.default`; a name is
// looked up in the configured drivers first, then the built-in ones, "default to the 3-way".
fn merge_driver(attribute: &AttributeValue, config: &MergeConfig) -> MergeDriver {
    let name = match attribute {
        AttributeValue::Set => return MergeDriver::Text,
        AttributeValue::Unset => return MergeDriver::Binary,
        AttributeValue::Unspecified => match &config.default {
            Some(name) => name,
            None => return MergeDriver::Text,
        },
        AttributeValue::Value(name) => name,
    };
    if config.drivers.contains(name) {
        return MergeDriver::Custom;
    }
    match name.as_slice() {
        b"binary" => MergeDriver::Binary,
        b"union" => MergeDriver::Union,
        _ => MergeDriver::Text,
    }
}

fn git_wrote<'a>(file: &StartFile<'a>) -> GitWrote<'a> {
    if file.attributes.encoded || file.stages.has_mode(SUBMODULE_MODE) {
        return GitWrote::NotWritten;
    }
    let ours = match (&file.stages.ours, &file.stages.theirs) {
        (None, None) => return GitWrote::Nothing,
        // merge-ort.c, modify/delete: "Version %s of %s left in tree" — the kept side.
        (Some(kept), None) | (None, Some(kept)) => return GitWrote::Stage(kept),
        (Some(ours), Some(_)) => ours,
    };
    // merge-ort.c `handle_content_merge`: two symlinks keep ours; merge-ll.c `ll_binary_merge`:
    // "For the final merge, it is 'ours' by default", also when any version is binary.
    if file.stages.has_mode(SYMLINK_MODE) {
        return GitWrote::Stage(ours);
    }
    let union = match file.attributes.driver {
        MergeDriver::Custom => return GitWrote::Unknown,
        MergeDriver::Binary => return GitWrote::Stage(ours),
        MergeDriver::Text => false,
        MergeDriver::Union => true,
    };
    match file.sides {
        Some(sides) if !sides.iter().any(|side| is_binary(side)) => {
            GitWrote::Merged { sides, union }
        }
        Some(_) | None => GitWrote::Stage(ours),
    }
}

impl<'r> StartCheck<'r> {
    pub(crate) fn new(repo: &'r Repo) -> StartCheck<'r> {
        StartCheck {
            repo,
            scratch: None,
            histogram: None,
            rerere: RerereTracked::NotRead,
            merge_file_runs: 0,
            started: Instant::now(),
        }
    }

    pub(crate) fn look(&mut self, file: &StartFile, blobs: &mut BlobReader) -> Result<StartLook> {
        let look = match git_wrote(file) {
            GitWrote::NotWritten => StartLook::Untouched,
            GitWrote::Nothing if *file.disk == OnDisk::Missing => StartLook::Untouched,
            GitWrote::Unknown | GitWrote::Nothing => StartLook::Changed,
            GitWrote::Merged { sides, union } => self.compare_merged(file, sides, union),
            GitWrote::Stage(entry) => compare_stage(file, entry, blobs)?,
        };
        Ok(look)
    }

    fn compare_merged(&mut self, file: &StartFile, sides: &[Vec<u8>; 3], union: bool) -> StartLook {
        let OnDisk::File(disk) = file.disk else {
            return StartLook::Changed;
        };
        let marker_size = file.attributes.marker_size;
        match self.merged(sides, marker_size, union) {
            Ok(output) if views(disk, marker_size) == views(&output, marker_size) => {
                StartLook::Untouched
            }
            Ok(output)
                if looks_resolved(&output, disk, marker_size)
                    && has_replayed(&mut self.rerere, self.repo, file.path) =>
            {
                StartLook::Remembered { git_output: output }
            }
            Ok(_) => StartLook::Changed,
            Err(error) => {
                let path = file.path.to_string_lossy();
                tracing::warn!(target: LOG_TARGET, event = "start_merge_file_failed", %path, %error, "the file counts as untouched");
                StartLook::Untouched
            }
        }
    }

    fn merged(
        &mut self,
        sides: &[Vec<u8>; 3],
        marker_size: usize,
        union: bool,
    ) -> std::result::Result<Vec<u8>, String> {
        let histogram = self.histogram()?;
        let scratch = match self.scratch.take() {
            Some(scratch) => scratch,
            None => ScratchDir::create().map_err(|error| error.to_string())?,
        };
        let [base, ours, theirs] = sides;
        let options = MergeFileOptions {
            marker_size,
            union,
            histogram,
        };
        self.merge_file_runs += 1;
        let merged = self
            .repo
            .merge_file(&scratch.0, base, ours, theirs, &options);
        self.scratch = Some(scratch);
        merged.map_err(|error| error.to_string())
    }

    fn histogram(&mut self) -> std::result::Result<bool, String> {
        if let Some(histogram) = self.histogram {
            return Ok(histogram);
        }
        let version = self.repo.version().map_err(|error| error.to_string())?;
        let histogram = version >= HISTOGRAM_SINCE;
        self.histogram = Some(histogram);
        Ok(histogram)
    }

    /// What was found for each path, in the order of `looks`.
    pub(crate) fn found(self, looks: Vec<(&Path, StartLook)>) -> Vec<Found> {
        let mut hashed_paths = Vec::new();
        for (path, look) in &looks {
            match look {
                StartLook::BlobOf(_) => hashed_paths.push(*path),
                StartLook::Untouched | StartLook::Changed | StartLook::Remembered { .. } => {}
            }
        }
        let hashes = match self.repo.hash_objects(&hashed_paths) {
            Ok(hashes) => Some(hashes),
            Err(error) => {
                tracing::warn!(target: LOG_TARGET, event = "start_hash_failed", %error, "files git wrote one stage to count as untouched");
                None
            }
        };
        let mut hashes = hashes.map(Vec::into_iter);
        let mut found = Vec::with_capacity(looks.len());
        for (_, look) in looks {
            found.push(match look {
                StartLook::Untouched => Found::Untouched,
                StartLook::Changed => Found::Changed,
                StartLook::Remembered { git_output } => Found::Remembered { git_output },
                StartLook::BlobOf(expected) => {
                    let untouched = match &mut hashes {
                        Some(hashes) => hashes.next().is_some_and(|hash| hash == expected),
                        None => true,
                    };
                    if untouched {
                        Found::Untouched
                    } else {
                        Found::Changed
                    }
                }
            });
        }
        let elapsed_ms = self.started.elapsed().as_millis();
        tracing::debug!(target: LOG_TARGET, event = "start_checked", merge_file_runs = self.merge_file_runs, hashed = hashed_paths.len(), elapsed_ms, "compared the worktree with what git wrote");
        found
    }
}

fn compare_stage(
    file: &StartFile,
    entry: &StageEntry,
    blobs: &mut BlobReader,
) -> Result<StartLook> {
    let is_link = entry.mode == SYMLINK_MODE;
    let look = match file.disk {
        OnDisk::Link(target) if is_link => same(&blobs.read(&entry.oid)?, target),
        // git-config(1) `core.symlinks`: "If false, symbolic links are checked out as small plain
        // files that contain the link text" (the default of Git for Windows).
        OnDisk::File(bytes) if is_link => same(&blobs.read(&entry.oid)?, bytes),
        // git-hash-object(1) `--stdin-paths` reads one path per line.
        OnDisk::File(bytes) if file.path.as_os_str().as_encoded_bytes().contains(&b'\n') => {
            same(&blobs.read(&entry.oid)?, bytes)
        }
        OnDisk::File(_) => StartLook::BlobOf(entry.oid.clone()),
        OnDisk::Missing | OnDisk::Link(_) | OnDisk::Submodule(_) | OnDisk::Other => {
            StartLook::Changed
        }
    };
    Ok(look)
}

fn same(expected: &[u8], found: &[u8]) -> StartLook {
    if expected == found {
        StartLook::Untouched
    } else {
        StartLook::Changed
    }
}

/// rerere replayed a resolution into `path`: rerere is enabled and `MERGE_RR` no longer lists it.
fn has_replayed(rerere: &mut RerereTracked, repo: &Repo, path: &Path) -> bool {
    if let RerereTracked::NotRead = rerere {
        *rerere = match repo.rerere_tracked() {
            Ok(Some(paths)) => RerereTracked::Paths(paths),
            Ok(None) => RerereTracked::Off,
            Err(error) => {
                tracing::warn!(target: LOG_TARGET, event = "rerere_unread", %error, "every file that looks resolved counts as remembered");
                RerereTracked::Unknown
            }
        };
    }
    match rerere {
        RerereTracked::Paths(paths) => !paths.iter().any(|tracked| tracked == path),
        RerereTracked::Unknown => true,
        RerereTracked::NotRead | RerereTracked::Off => false,
    }
}

/// git's merge output has conflict blocks and the disk file has no marker line left.
fn looks_resolved(git_output: &[u8], disk: &[u8], marker_size: usize) -> bool {
    let has_block = parse(&split_lines(git_output), marker_size)
        .iter()
        .any(|piece| matches!(piece, Piece::Block(_)));
    has_block && open_regions(&parse(&split_lines(disk), marker_size)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    const GIT_OUTPUT: &[u8] =
        b"top\n<<<<<<< ours\nlocal\n=======\nremote\n>>>>>>> theirs\nbottom\n";

    #[test]
    fn a_file_without_markers_over_git_output_with_a_block_looks_resolved() {
        let resolved = b"top\nlocal and remote\nbottom\n";

        assert!(looks_resolved(GIT_OUTPUT, resolved, DEFAULT_MARKER_SIZE));
    }

    // Catches a file still holding git's markers taken for a replayed resolution.
    #[test]
    fn a_file_with_markers_left_does_not_look_resolved() {
        let edited = b"top, edited\n<<<<<<< ours\nlocal\n=======\nremote\n>>>>>>> theirs\nbottom\n";

        assert!(!looks_resolved(GIT_OUTPUT, edited, DEFAULT_MARKER_SIZE));
    }

    // Catches a file git merged without a conflict block taken for a replayed resolution.
    #[test]
    fn without_a_block_in_git_output_nothing_looks_resolved() {
        let merged = b"top\nlocal\nbottom\n";

        assert!(!looks_resolved(
            merged,
            b"top\nedited\nbottom\n",
            DEFAULT_MARKER_SIZE
        ));
    }
}

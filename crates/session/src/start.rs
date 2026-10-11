use std::fs;
use std::io;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::DirBuilderExt;
use std::path::{Path, PathBuf};
use std::time::Instant;

use yamt_gitio::{
    AttributeValue, BlobReader, GitVersion, MergeAttributes, MergeConfig, MergeFileOptions, Oid,
    Repo, StageEntry,
};

use crate::Result;
use crate::decode::is_binary;
use crate::disk::OnDisk;
use crate::markers::{DEFAULT_MARKER_SIZE, views};
use crate::session::LOG_TARGET;
use crate::sides::{SUBMODULE_MODE, SYMLINK_MODE};
use crate::stages::CapturedStages;

// merge-ort merges with histogram (merge-ort.c `DIFF_WITH_ALG(opt, HISTOGRAM_DIFF)`); `git merge-file`
// has `--diff-algorithm` since 2.44 (git-merge-file(1)).
const HISTOGRAM_SINCE: GitVersion = GitVersion {
    major: 2,
    minor: 44,
};
const SCRATCH_ATTEMPTS: u32 = 1000;
const SCRATCH_MODE: u32 = 0o700;

/// The gitattributes that decide what git wrote to a conflicted path.
pub(crate) struct Attributes {
    pub(crate) marker_size: usize,
    pub(crate) driver: MergeDriver,
    /// `working-tree-encoding` is set: the worktree bytes are not the blob's encoding.
    pub(crate) encoded: bool,
}

/// The `merge` attribute (gitattributes(5) "Built-in merge drivers").
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum MergeDriver {
    Text,
    Union,
    /// `-merge` or `merge=binary`: git keeps ours.
    Binary,
    /// Any other driver: what it wrote cannot be known.
    Custom,
}

/// One conflicted path as `open()` found it, before its stages are decoded.
pub(crate) struct StartFile<'a> {
    pub(crate) path: &'a Path,
    pub(crate) stages: &'a CapturedStages,
    /// base, local and remote bytes of a regular file with at least one side.
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
    merge_file_runs: u32,
    started: Instant,
}

/// A directory under the system temp directory, removed when dropped.
struct ScratchDir(PathBuf);

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
    let local = match (&file.stages.local, &file.stages.remote) {
        (None, None) => return GitWrote::Nothing,
        // merge-ort.c, modify/delete: "Version %s of %s left in tree" — the kept side.
        (Some(kept), None) | (None, Some(kept)) => return GitWrote::Stage(kept),
        (Some(local), Some(_)) => local,
    };
    // merge-ort.c `handle_content_merge`: two symlinks keep ours; merge-ll.c `ll_binary_merge`:
    // "For the final merge, it is 'ours' by default", also when any version is binary.
    if file.stages.has_mode(SYMLINK_MODE) {
        return GitWrote::Stage(local);
    }
    let union = match file.attributes.driver {
        MergeDriver::Custom => return GitWrote::Unknown,
        MergeDriver::Binary => return GitWrote::Stage(local),
        MergeDriver::Text => false,
        MergeDriver::Union => true,
    };
    match file.sides {
        Some(sides) if !sides.iter().any(|side| is_binary(side)) => {
            GitWrote::Merged { sides, union }
        }
        Some(_) | None => GitWrote::Stage(local),
    }
}

impl<'r> StartCheck<'r> {
    pub(crate) fn new(repo: &'r Repo) -> StartCheck<'r> {
        StartCheck {
            repo,
            scratch: None,
            histogram: None,
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
        let [base, local, remote] = sides;
        let options = MergeFileOptions {
            marker_size,
            union,
            histogram,
        };
        self.merge_file_runs += 1;
        let merged = self
            .repo
            .merge_file(&scratch.0, base, local, remote, &options);
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

    /// Whether each path is untouched, in the order of `looks`.
    pub(crate) fn untouched(self, looks: &[(&Path, StartLook)]) -> Vec<bool> {
        let mut hashed_paths = Vec::new();
        for (path, look) in looks {
            match look {
                StartLook::BlobOf(_) => hashed_paths.push(*path),
                StartLook::Untouched | StartLook::Changed => {}
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
        let mut untouched = Vec::with_capacity(looks.len());
        for (_, look) in looks {
            untouched.push(match look {
                StartLook::Untouched => true,
                StartLook::Changed => false,
                StartLook::BlobOf(expected) => match &mut hashes {
                    Some(hashes) => hashes.next().is_some_and(|hash| hash == *expected),
                    None => true,
                },
            });
        }
        let elapsed_ms = self.started.elapsed().as_millis();
        tracing::debug!(target: LOG_TARGET, event = "start_checked", merge_file_runs = self.merge_file_runs, hashed = hashed_paths.len(), elapsed_ms, "compared the worktree with what git wrote");
        untouched
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
        // git-hash-object(1) `--stdin-paths` reads one path per line.
        OnDisk::File(bytes) if !is_link && file.path.as_os_str().as_bytes().contains(&b'\n') => {
            same(&blobs.read(&entry.oid)?, bytes)
        }
        OnDisk::File(_) if !is_link => StartLook::BlobOf(entry.oid.clone()),
        OnDisk::Missing
        | OnDisk::File(_)
        | OnDisk::Link(_)
        | OnDisk::Submodule(_)
        | OnDisk::Other => StartLook::Changed,
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

impl ScratchDir {
    fn create() -> io::Result<ScratchDir> {
        let temp = std::env::temp_dir();
        let process = std::process::id();
        for attempt in 0..SCRATCH_ATTEMPTS {
            let dir = temp.join(format!("yamt-merge-file-{process}-{attempt}"));
            match fs::DirBuilder::new().mode(SCRATCH_MODE).create(&dir) {
                Ok(()) => return Ok(ScratchDir(dir)),
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::from(io::ErrorKind::AlreadyExists))
    }
}

impl Drop for ScratchDir {
    fn drop(&mut self) {
        if let Err(error) = fs::remove_dir_all(&self.0) {
            let dir = self.0.display();
            tracing::warn!(target: LOG_TARGET, event = "scratch_not_removed", %dir, %error, "temporary merge inputs were left behind");
        }
    }
}

#[cfg(test)]
mod tests {
    use std::os::unix::fs::PermissionsExt;

    use super::*;

    const PERMISSION_BITS: u32 = 0o777;

    #[test]
    fn the_scratch_dir_is_readable_by_its_owner_only_and_removed_when_dropped() {
        let scratch = ScratchDir::create().unwrap();
        let dir = scratch.0.clone();
        let mode = fs::metadata(&dir).unwrap().permissions().mode();
        assert_eq!(mode & PERMISSION_BITS, SCRATCH_MODE);
        drop(scratch);
        assert!(!dir.exists());
    }
}

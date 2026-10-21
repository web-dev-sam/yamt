use std::path::{Path, PathBuf};

use yamt_gitio::{BlobReader, MergeAttributes, MergeConfig, Repo, StageEntry};

use crate::Result;
use crate::decode::{UnsupportedReason, decode_sides};
use crate::disk::{AtOpen, MarkerRule, OnDisk, read_on_disk, warn_unread};
use crate::merge_data::Texts;
use crate::orientation::{GitSide, Orientation};
use crate::session::{Content, FileState, FileStatus, MergeSession};
use crate::side_names::read_side_names;
use crate::sides::{SUBMODULE_MODE, SYMLINK_MODE, Side};
use crate::stages::{CapturedStages, group_by_path};
use crate::start::{Attributes, Found, StartCheck, StartFile, StartLook};

/// What the index holds for a path, with the blobs of a regular file read.
enum Stored {
    Submodule,
    Symlink,
    BothDeleted,
    /// base, ours and theirs bytes, in git's order; a deleted side holds base.
    Regular {
        deleted: Option<GitSide>,
        sides: [Vec<u8>; 3],
    },
}

impl MergeSession {
    pub fn open(cwd: &Path) -> Result<MergeSession> {
        let repo = Repo::discover(cwd)?;
        let stop = repo.stop()?;
        let orientation = Orientation::of(&stop);
        let groups = group_by_path(repo.unmerged()?);
        let paths: Vec<&Path> = groups.iter().map(|(path, _)| path.as_path()).collect();
        let attributes = repo.attributes(&paths)?;
        let config = repo.merge_config()?;
        let files = open_files(&repo, groups, &attributes, &config, orientation)?;
        let side_names = read_side_names(&repo, &stop, orientation);
        Ok(MergeSession {
            repo,
            files,
            side_names: Box::new(side_names),
            stop,
            orientation,
        })
    }
}

/// A file as read at open, before the start check tells whether git's output is untouched.
struct Opened {
    path: PathBuf,
    stages: CapturedStages,
    content: Content,
    rule: MarkerRule,
    marker_size: usize,
    /// `None`: the worktree entry could not be read.
    disk: Option<OnDisk>,
}

fn open_files(
    repo: &Repo,
    groups: Vec<(PathBuf, CapturedStages)>,
    attributes: &[MergeAttributes],
    config: &MergeConfig,
    orientation: Orientation,
) -> Result<Vec<FileState>> {
    let mut blobs = repo.blob_reader()?;
    let mut check = StartCheck::new(repo);
    let mut opened = Vec::with_capacity(groups.len());
    let mut looks = Vec::with_capacity(groups.len());
    for ((path, stages), found) in groups.into_iter().zip(attributes) {
        let attributes = Attributes::from_git(found, config);
        let (file, look) = open_file(
            repo,
            &mut blobs,
            &mut check,
            path,
            stages,
            &attributes,
            orientation,
        )?;
        opened.push(file);
        looks.push(look);
    }
    let paths = opened.iter().map(|file| file.path.as_path());
    let looks: Vec<(&Path, StartLook)> = paths.zip(looks).collect();
    let found = check.found(looks);
    let mut files = Vec::with_capacity(opened.len());
    for (file, found) in opened.into_iter().zip(found) {
        files.push(file_state(file, found));
    }
    Ok(files)
}

fn open_file(
    repo: &Repo,
    blobs: &mut BlobReader,
    check: &mut StartCheck,
    path: PathBuf,
    stages: CapturedStages,
    attributes: &Attributes,
    orientation: Orientation,
) -> Result<(Opened, StartLook)> {
    let stored = stored(blobs, &stages)?;
    let (disk, look) = match read_on_disk(repo, &path, stages.has_mode(SUBMODULE_MODE)) {
        Ok(disk) => {
            let sides = match &stored {
                Stored::Regular { sides, .. } => Some(sides),
                Stored::Submodule | Stored::Symlink | Stored::BothDeleted => None,
            };
            let start = StartFile {
                path: &path,
                stages: &stages,
                sides,
                attributes,
                disk: &disk,
            };
            let look = check.look(&start, blobs)?;
            (Some(disk), look)
        }
        Err(error) => {
            warn_unread(&path.to_string_lossy(), &error);
            (None, StartLook::Changed)
        }
    };
    let content = content(&path, stored, orientation);
    let opened = Opened {
        rule: marker_rule(&content, attributes),
        path,
        stages,
        content,
        marker_size: attributes.marker_size,
        disk,
    };
    Ok((opened, look))
}

fn file_state(opened: Opened, found: Found) -> FileState {
    let at_open = match (opened.disk, found) {
        (Some(disk), Found::Untouched) => AtOpen::Untouched(disk),
        (Some(OnDisk::File(remembered)), Found::Remembered { git_output }) => AtOpen::Remembered {
            remembered,
            git_output,
        },
        (Some(disk), Found::Changed | Found::Remembered { .. }) => AtOpen::Changed(disk),
        (None, _) => AtOpen::Unread,
    };
    let mut file = FileState {
        path: opened.path,
        stages: opened.stages,
        status: FileStatus::Unresolved,
        content: opened.content,
        marker_size: opened.marker_size,
        rule: opened.rule,
        seen: at_open.first_seen(),
        settled: None,
        at_open,
    };
    file.status = file.unmerged_status();
    file
}

fn stored(blobs: &mut BlobReader, stages: &CapturedStages) -> Result<Stored> {
    if stages.has_mode(SUBMODULE_MODE) {
        return Ok(Stored::Submodule);
    }
    if stages.has_mode(SYMLINK_MODE) {
        return Ok(Stored::Symlink);
    }
    let deleted = match (&stages.ours, &stages.theirs) {
        (Some(_), Some(_)) => None,
        (None, Some(_)) => Some(GitSide::Ours),
        (Some(_), None) => Some(GitSide::Theirs),
        (None, None) => return Ok(Stored::BothDeleted),
    };
    let base = stage_bytes(blobs, stages.base.as_ref(), b"")?;
    let ours = stage_bytes(blobs, stages.ours.as_ref(), &base)?;
    let theirs = stage_bytes(blobs, stages.theirs.as_ref(), &base)?;
    Ok(Stored::Regular {
        deleted,
        sides: [base, ours, theirs],
    })
}

fn stage_bytes(
    blobs: &mut BlobReader,
    entry: Option<&StageEntry>,
    missing: &[u8],
) -> Result<Vec<u8>> {
    match entry {
        Some(entry) => Ok(blobs.read(&entry.oid)?),
        None => Ok(missing.to_vec()),
    }
}

fn content(path: &Path, stored: Stored, orientation: Orientation) -> Content {
    if path.to_str().is_none() {
        return Content::Unsupported(UnsupportedReason::NonUtf8);
    }
    let (deleted, sides) = match stored {
        Stored::Submodule => return Content::Unsupported(UnsupportedReason::Submodule),
        Stored::Symlink => return Content::Unsupported(UnsupportedReason::Symlink),
        Stored::BothDeleted => return Content::Unsupported(UnsupportedReason::LocalDeleted),
        Stored::Regular { deleted, sides } => (deleted.map(|side| orientation.pane(side)), sides),
    };
    match decode_sides(sides) {
        Ok([base, ours, theirs]) => {
            let (local, remote) = orientation.panes(ours, theirs);
            Content::Text(Texts {
                base,
                local,
                remote,
                deleted,
            })
        }
        Err(reason) => Content::Unsupported(deleted_reason(deleted).unwrap_or(reason)),
    }
}

fn deleted_reason(deleted: Option<Side>) -> Option<UnsupportedReason> {
    deleted.map(|side| match side {
        Side::Local => UnsupportedReason::LocalDeleted,
        Side::Remote => UnsupportedReason::RemoteDeleted,
    })
}

fn marker_rule(content: &Content, attributes: &Attributes) -> MarkerRule {
    if attributes.encoded {
        return MarkerRule::NeverStage;
    }
    match content {
        Content::Text(texts) if texts.deleted.is_none() => MarkerRule::StageWithoutMarkers,
        Content::Text(_) => MarkerRule::StageAny,
        Content::Unsupported(reason) => match reason {
            UnsupportedReason::NonUtf8 | UnsupportedReason::TooLarge => {
                MarkerRule::StageWithoutMarkers
            }
            UnsupportedReason::Binary
            | UnsupportedReason::LocalDeleted
            | UnsupportedReason::RemoteDeleted
            | UnsupportedReason::Symlink
            | UnsupportedReason::Submodule => MarkerRule::StageAny,
        },
    }
}

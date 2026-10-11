use std::path::{Path, PathBuf};

use yamt_gitio::{BlobReader, MergeAttributes, Repo, StageEntry};

use crate::Result;
use crate::decode::{UnsupportedReason, decode_sides};
use crate::disk::{MarkerRule, Seen, read_on_disk};
use crate::merge_data::Texts;
use crate::remote_name::read_remote_name;
use crate::session::{Content, FileState, FileStatus, MergeSession};
use crate::sides::{SUBMODULE_MODE, SYMLINK_MODE, Side};
use crate::stages::{CapturedStages, group_by_path};
use crate::start::{Attributes, StartCheck, StartFile, StartLook};

/// What the index holds for a path, with the blobs of a regular file read.
enum Stored {
    Submodule,
    Symlink,
    BothDeleted,
    /// base, local and remote bytes; a deleted side holds base.
    Regular {
        deleted: Option<Side>,
        sides: [Vec<u8>; 3],
    },
}

impl MergeSession {
    pub fn open(cwd: &Path) -> Result<MergeSession> {
        let repo = Repo::discover(cwd)?;
        let groups = group_by_path(repo.unmerged()?);
        let paths: Vec<&Path> = groups.iter().map(|(path, _)| path.as_path()).collect();
        let attributes = repo.attributes(&paths)?;
        let files = open_files(&repo, groups, &attributes)?;
        let remote_name = read_remote_name(&repo);
        Ok(MergeSession {
            repo,
            files,
            remote_name,
        })
    }
}

fn open_files(
    repo: &Repo,
    groups: Vec<(PathBuf, CapturedStages)>,
    attributes: &[MergeAttributes],
) -> Result<Vec<FileState>> {
    let mut blobs = repo.blob_reader()?;
    let mut check = StartCheck::new(repo);
    let mut files = Vec::with_capacity(groups.len());
    let mut looks = Vec::with_capacity(groups.len());
    for ((path, stages), found) in groups.into_iter().zip(attributes) {
        let (file, look) = open_file(repo, &mut blobs, &mut check, path, stages, found)?;
        files.push(file);
        looks.push(look);
    }
    let paths = files.iter().map(|file| file.path.as_path());
    let looks: Vec<(&Path, StartLook)> = paths.zip(looks).collect();
    let untouched = check.untouched(&looks);
    for (file, untouched) in files.iter_mut().zip(untouched) {
        if !untouched {
            file.seen = Seen::GitOutput;
        }
    }
    Ok(files)
}

fn open_file(
    repo: &Repo,
    blobs: &mut BlobReader,
    check: &mut StartCheck,
    path: PathBuf,
    stages: CapturedStages,
    found: &MergeAttributes,
) -> Result<(FileState, StartLook)> {
    let attributes = Attributes::from_git(found);
    let stored = stored(blobs, &stages)?;
    let disk = read_on_disk(repo, &path, stages.has_mode(SUBMODULE_MODE))?;
    let sides = match &stored {
        Stored::Regular { sides, .. } => Some(sides),
        Stored::Submodule | Stored::Symlink | Stored::BothDeleted => None,
    };
    let start = StartFile {
        path: &path,
        stages: &stages,
        sides,
        attributes: &attributes,
        disk: &disk,
    };
    let look = check.look(&start, blobs)?;
    let content = content(&path, stored);
    let file = FileState {
        rule: marker_rule(&content, &attributes),
        path,
        stages,
        status: FileStatus::Unresolved,
        content,
        marker_size: attributes.marker_size,
        seen: Seen::Stages(disk),
        settled: None,
    };
    Ok((file, look))
}

fn stored(blobs: &mut BlobReader, stages: &CapturedStages) -> Result<Stored> {
    if stages.has_mode(SUBMODULE_MODE) {
        return Ok(Stored::Submodule);
    }
    if stages.has_mode(SYMLINK_MODE) {
        return Ok(Stored::Symlink);
    }
    let deleted = match (&stages.local, &stages.remote) {
        (Some(_), Some(_)) => None,
        (None, Some(_)) => Some(Side::Local),
        (Some(_), None) => Some(Side::Remote),
        (None, None) => return Ok(Stored::BothDeleted),
    };
    let base = stage_bytes(blobs, stages.base.as_ref(), b"")?;
    let local = stage_bytes(blobs, stages.local.as_ref(), &base)?;
    let remote = stage_bytes(blobs, stages.remote.as_ref(), &base)?;
    Ok(Stored::Regular {
        deleted,
        sides: [base, local, remote],
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

fn content(path: &Path, stored: Stored) -> Content {
    if path.to_str().is_none() {
        return Content::Unsupported(UnsupportedReason::NonUtf8);
    }
    let (deleted, sides) = match stored {
        Stored::Submodule => return Content::Unsupported(UnsupportedReason::Submodule),
        Stored::Symlink => return Content::Unsupported(UnsupportedReason::Symlink),
        Stored::BothDeleted => return Content::Unsupported(UnsupportedReason::LocalDeleted),
        Stored::Regular { deleted, sides } => (deleted, sides),
    };
    match decode_sides(sides) {
        Ok([base, local, remote]) => Content::Text(Texts {
            base,
            local,
            remote,
            deleted,
        }),
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

use std::path::PathBuf;

use yamt_gitio::{Stage, StageEntry};

use crate::orientation::GitSide;
use crate::sides::SUBMODULE_MODE;

#[derive(Default)]
pub(crate) struct CapturedStages {
    pub(crate) base: Option<StageEntry>,
    pub(crate) ours: Option<StageEntry>,
    pub(crate) theirs: Option<StageEntry>,
}

impl CapturedStages {
    pub(crate) fn of(&self, side: GitSide) -> Option<&StageEntry> {
        match side {
            GitSide::Ours => self.ours.as_ref(),
            GitSide::Theirs => self.theirs.as_ref(),
        }
    }

    fn insert(&mut self, entry: StageEntry) {
        match entry.stage {
            Stage::Base => self.base = Some(entry),
            Stage::Ours => self.ours = Some(entry),
            Stage::Theirs => self.theirs = Some(entry),
        }
    }

    pub(crate) fn can_rebuild_markers(&self) -> bool {
        // `checkout -m` refuses a path without both sides: "does not have all necessary versions" (git builtin/checkout.c, observed on git 2.56).
        let has_both_sides = self.ours.is_some() && self.theirs.is_some();
        // A gitlink stage is a commit, not a blob: "fatal: unable to read blob object" (exit 128, observed on git 2.56).
        has_both_sides && !self.has_mode(SUBMODULE_MODE)
    }

    pub(crate) fn has_mode(&self, mode: u32) -> bool {
        [&self.base, &self.ours, &self.theirs]
            .into_iter()
            .flatten()
            .any(|entry| entry.mode == mode)
    }

    pub(crate) fn entries(&self) -> Vec<StageEntry> {
        [&self.base, &self.ours, &self.theirs]
            .into_iter()
            .flatten()
            .cloned()
            .collect()
    }
}

pub(crate) fn group_by_path(entries: Vec<StageEntry>) -> Vec<(PathBuf, CapturedStages)> {
    let mut groups: Vec<(PathBuf, CapturedStages)> = Vec::new();
    for entry in entries {
        if let Some((path, stages)) = groups.last_mut()
            && *path == entry.path
        {
            stages.insert(entry);
        } else {
            let mut stages = CapturedStages::default();
            let path = entry.path.clone();
            stages.insert(entry);
            groups.push((path, stages));
        }
    }
    groups
}

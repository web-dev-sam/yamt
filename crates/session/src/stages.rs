use std::path::PathBuf;

use yamt_gitio::{Stage, StageEntry};

use crate::sides::{SUBMODULE_MODE, Side};

#[derive(Default)]
pub(crate) struct CapturedStages {
    pub(crate) base: Option<StageEntry>,
    pub(crate) local: Option<StageEntry>,
    pub(crate) remote: Option<StageEntry>,
}

impl CapturedStages {
    pub(crate) fn side(&self, side: Side) -> Option<&StageEntry> {
        match side {
            Side::Local => self.local.as_ref(),
            Side::Remote => self.remote.as_ref(),
        }
    }

    fn insert(&mut self, entry: StageEntry) {
        match entry.stage {
            Stage::Base => self.base = Some(entry),
            Stage::Local => self.local = Some(entry),
            Stage::Remote => self.remote = Some(entry),
        }
    }

    pub(crate) fn can_rebuild_markers(&self) -> bool {
        // `checkout -m` refuses a path without both sides: "does not have all necessary versions" (git builtin/checkout.c, observed on git 2.56).
        let has_both_sides = self.local.is_some() && self.remote.is_some();
        // A gitlink stage is a commit, not a blob: "fatal: unable to read blob object" (exit 128, observed on git 2.56).
        has_both_sides && !self.has_mode(SUBMODULE_MODE)
    }

    pub(crate) fn has_mode(&self, mode: u32) -> bool {
        [&self.base, &self.local, &self.remote]
            .into_iter()
            .flatten()
            .any(|entry| entry.mode == mode)
    }

    pub(crate) fn entries(&self) -> Vec<StageEntry> {
        [&self.base, &self.local, &self.remote]
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

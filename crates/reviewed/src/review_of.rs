use yamt_range::{Dots, SideName, SideNames, fnv1a_64};

/// What a window's marks belong to (rule 4).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReviewOf {
    Range(SideNames),
    MergeRequest { project: String, iid: u32 },
}

impl ReviewOf {
    /// `range ref:refs/heads/dev...ref:refs/heads/feature-x`, `range commit:<hex>..ref:refs/heads/x`,
    /// `merge-request group/project!12`.
    #[must_use]
    pub fn key_text(&self) -> String {
        match self {
            ReviewOf::Range(names) => format!(
                "range {}{}{}",
                side_text(&names.left),
                dots_text(names.dots),
                side_text(&names.right)
            ),
            ReviewOf::MergeRequest { project, iid } => format!("merge-request {project}!{iid}"),
        }
    }

    /// The review's folder name: the FNV-1a 64 of its key text, so no name escapes or grows past a file name's limit.
    pub(crate) fn folder_name(&self) -> String {
        format!("{:016x}", fnv1a_64(self.key_text().as_bytes()))
    }
}

fn side_text(side: &SideName) -> String {
    match side {
        SideName::Ref { full_name } => format!("ref:{full_name}"),
        SideName::Commit { id } => format!("commit:{}", id.as_str()),
    }
}

fn dots_text(dots: Dots) -> &'static str {
    match dots {
        Dots::Two => "..",
        Dots::Three => "...",
    }
}

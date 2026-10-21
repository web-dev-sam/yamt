use std::collections::HashSet;
use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::files::{read_failed, write_atomically};
use crate::{Error, Result, TabId, TabLanguage};

const FORMAT: u32 = 1;
const FIRST_ID: TabId = TabId(1);

/// `tabs.json`: the tabs in their order, the shown one, and the id the next tab gets.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Index {
    format: u32,
    pub(crate) shown: TabId,
    next_id: TabId,
    pub(crate) tabs: Vec<StoredTab>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct StoredTab {
    pub(crate) id: TabId,
    number: u32,
    pub(crate) name: String,
    pub(crate) language: TabLanguage,
}

#[derive(Deserialize)]
struct FormatOnly {
    format: u32,
}

impl Index {
    pub(crate) fn first() -> Index {
        let mut index = Index {
            format: FORMAT,
            shown: FIRST_ID,
            next_id: FIRST_ID,
            tabs: Vec::new(),
        };
        index.add_tab();
        index
    }

    /// Appends "Compare <number>" with a number above every tab's, and shows it.
    pub(crate) fn add_tab(&mut self) {
        let number = self.tabs.iter().map(|tab| tab.number).max().unwrap_or(0) + 1;
        let id = self.next_id;
        self.next_id = TabId(id.0 + 1);
        self.tabs.push(StoredTab {
            id,
            number,
            name: format!("Compare {number}"),
            language: TabLanguage::Auto,
        });
        self.shown = id;
    }

    /// The next tab is shown when the shown one goes, else the previous; the last one gone leaves a new tab.
    pub(crate) fn close_tab(&mut self, tab: TabId) -> Result<()> {
        let position = self.position(tab)?;
        self.tabs.remove(position);
        if self.tabs.is_empty() {
            self.add_tab();
        } else if self.shown == tab {
            let shown_at = position.min(self.tabs.len() - 1);
            if let Some(shown) = self.tabs.get(shown_at) {
                self.shown = shown.id;
            }
        }
        Ok(())
    }

    pub(crate) fn tab_mut(&mut self, tab: TabId) -> Result<&mut StoredTab> {
        self.tabs
            .iter_mut()
            .find(|stored| stored.id == tab)
            .ok_or(Error::UnknownTab { tab })
    }

    pub(crate) fn require_tab(&self, tab: TabId) -> Result<()> {
        self.position(tab).map(|_| ())
    }

    pub(crate) fn ids(&self) -> HashSet<TabId> {
        self.tabs.iter().map(|tab| tab.id).collect()
    }

    fn position(&self, tab: TabId) -> Result<usize> {
        self.tabs
            .iter()
            .position(|stored| stored.id == tab)
            .ok_or(Error::UnknownTab { tab })
    }

    /// What makes a parsed index unusable: an id repeated, at or above `nextId`, or a shown tab not listed.
    fn problem(&self) -> Option<String> {
        if self.tabs.is_empty() {
            return Some("`tabs` is empty".to_owned());
        }
        let mut seen = HashSet::new();
        for tab in &self.tabs {
            if !seen.insert(tab.id) {
                return Some(format!("the tab id {} appears twice", tab.id.0));
            }
            if tab.id.0 >= self.next_id.0 {
                return Some(format!(
                    "the tab id {} is not below `nextId` {}",
                    tab.id.0, self.next_id.0
                ));
            }
        }
        if !seen.contains(&self.shown) {
            return Some(format!("the shown tab {} is not in `tabs`", self.shown.0));
        }
        None
    }
}

/// `None` when there is no `tabs.json` at `path`.
pub(crate) fn read_index(path: &Path) -> Result<Option<Index>> {
    match fs::read(path) {
        Ok(bytes) => parsed(path, &bytes).map(Some),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(read_failed(path, error.to_string())),
    }
}

fn parsed(path: &Path, bytes: &[u8]) -> Result<Index> {
    let broken = |message: String| Error::Broken {
        path: path.to_owned(),
        message,
    };
    let FormatOnly { format } =
        serde_json::from_slice(bytes).map_err(|error| broken(error.to_string()))?;
    if format > FORMAT {
        return Err(Error::NewerFormat {
            path: path.to_owned(),
            format,
        });
    }
    if format != FORMAT {
        return Err(broken(format!("format {format} is not {FORMAT}")));
    }
    let index: Index = serde_json::from_slice(bytes).map_err(|error| broken(error.to_string()))?;
    match index.problem() {
        Some(message) => Err(broken(message)),
        None => Ok(index),
    }
}

pub(crate) fn write_index(path: &Path, index: &Index) -> Result<()> {
    let mut text = serde_json::to_string_pretty(index).map_err(|error| Error::WriteFailed {
        path: path.to_owned(),
        message: error.to_string(),
    })?;
    text.push('\n');
    write_atomically(path, &text)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn index_of(json: &str) -> Result<Index> {
        parsed(Path::new("tabs.json"), json.as_bytes())
    }

    fn problem_of(json: &str) -> String {
        match index_of(json) {
            Err(Error::Broken { message, .. }) => message,
            other => panic!("expected Broken, got {other:?}"),
        }
    }

    #[test]
    fn the_first_index_has_compare_1_shown() {
        let index = Index::first();
        assert_eq!(index.shown, FIRST_ID);
        assert_eq!(index.next_id, TabId(2));
        assert_eq!(index.tabs.len(), 1);
        assert_eq!(index.tabs[0].name, "Compare 1");
        assert_eq!(index.tabs[0].number, 1);
        assert!(index.problem().is_none());
    }

    #[test]
    fn an_index_without_tabs_is_broken() {
        let message = problem_of(r#"{"format":1,"shown":1,"nextId":2,"tabs":[]}"#);
        assert_eq!(message, "`tabs` is empty");
    }

    #[test]
    fn a_repeated_id_is_broken() {
        let tab = r#"{"id":1,"number":1,"name":"a","language":{"kind":"auto"}}"#;
        let message = problem_of(&format!(
            r#"{{"format":1,"shown":1,"nextId":2,"tabs":[{tab},{tab}]}}"#
        ));
        assert_eq!(message, "the tab id 1 appears twice");
    }

    #[test]
    fn an_id_at_next_id_is_broken_so_ids_never_repeat() {
        let message = problem_of(
            r#"{"format":1,"shown":2,"nextId":2,"tabs":[{"id":2,"number":1,"name":"a","language":{"kind":"auto"}}]}"#,
        );
        assert_eq!(message, "the tab id 2 is not below `nextId` 2");
    }

    #[test]
    fn a_shown_tab_not_listed_is_broken() {
        let message = problem_of(
            r#"{"format":1,"shown":5,"nextId":6,"tabs":[{"id":1,"number":1,"name":"a","language":{"kind":"auto"}}]}"#,
        );
        assert_eq!(message, "the shown tab 5 is not in `tabs`");
    }

    #[test]
    fn format_0_is_broken_not_newer() {
        let message = problem_of(r#"{"format":0}"#);
        assert_eq!(message, "format 0 is not 1");
    }

    #[test]
    fn a_picked_language_reads_back() {
        let index = index_of(
            r#"{"format":1,"shown":1,"nextId":2,"tabs":[{"id":1,"number":1,"name":"a","language":{"kind":"picked","name":"JSON"}}]}"#,
        )
        .unwrap();
        assert_eq!(
            index.tabs[0].language,
            TabLanguage::Picked {
                name: "JSON".to_owned()
            }
        );
    }
}

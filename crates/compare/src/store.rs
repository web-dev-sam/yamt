use std::collections::HashMap;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::files::{
    INDEX_FILE, column_path, has_text_on_disk, read_column, remove_columns, remove_orphans,
    require_within_limit, take_lock, write_atomically, write_failed,
};
use crate::index::{Index, read_index, write_index};
use crate::{
    Column, ColumnVersion, CompareStart, LoadedTab, MAX_COLUMN_BYTES, Result, TabEntry, TabId,
    TabLanguage, TabList,
};

/// The stored tabs of one data folder, held by one process at a time.
#[derive(Debug)]
pub struct TabStore {
    dir: PathBuf,
    index: Index,
    loaded: HashMap<TabId, LoadedTab>,
    _lock: File,
}

impl TabStore {
    /// Creates `dir`, takes its lock, reads `tabs.json` (or writes a first one) and removes the
    /// column files of tabs it does not list.
    pub fn open(dir: &Path) -> Result<TabStore> {
        let index_path = dir.join(INDEX_FILE);
        // Read before the lock, so a broken store gets no lock file, and again under it: the window
        // that held the lock may have written the index until it ended.
        read_index(&index_path)?;
        fs::create_dir_all(dir).map_err(|error| write_failed(dir, &error))?;
        let lock = take_lock(dir)?;
        let index = if let Some(index) = read_index(&index_path)? {
            index
        } else {
            let index = Index::first(&index_path)?;
            write_index(&index_path, &index)?;
            index
        };
        remove_orphans(dir, &index.ids())?;
        Ok(TabStore {
            dir: dir.to_owned(),
            index,
            loaded: HashMap::new(),
            _lock: lock,
        })
    }

    /// The tabs and the column limit.
    #[must_use]
    pub fn start(&self) -> CompareStart {
        CompareStart {
            list: self.list(),
            column_limit: MAX_COLUMN_BYTES,
        }
    }

    /// Reads the tab's two column files the first time; later calls return the same texts.
    pub fn load_tab(&mut self, tab: TabId) -> Result<LoadedTab> {
        if let Some(loaded) = self.loaded.get(&tab) {
            return Ok(loaded.clone());
        }
        self.index.require_tab(tab)?;
        let left = read_column(&column_path(&self.dir, tab, Column::Left))?;
        let right = read_column(&column_path(&self.dir, tab, Column::Right))?;
        let loaded = LoadedTab::new(left, right);
        self.loaded.insert(tab, loaded.clone());
        Ok(loaded)
    }

    /// Stores and writes one column when `version` is above the stored one; otherwise stores
    /// nothing. Returns the texts and versions now stored.
    pub fn set_column(
        &mut self,
        tab: TabId,
        column: Column,
        text: String,
        version: ColumnVersion,
    ) -> Result<LoadedTab> {
        let stored = self.load_tab(tab)?;
        if version <= stored.version(column) {
            return Ok(stored);
        }
        require_within_limit(text.len())?;
        write_atomically(&column_path(&self.dir, tab, column), &text)?;
        let changed = stored.with_column(column, Arc::from(text), version);
        self.loaded.insert(tab, changed.clone());
        Ok(changed)
    }

    /// Appends a new tab and shows it.
    pub fn add_tab(&mut self) -> Result<TabList> {
        let mut next = self.index.clone();
        next.add_tab(&self.index_path())?;
        self.commit(next)?;
        Ok(self.list())
    }

    /// Removes the tab from `tabs.json`, then its column files.
    pub fn close_tab(&mut self, tab: TabId) -> Result<TabList> {
        let mut next = self.index.clone();
        next.close_tab(tab, &self.index_path())?;
        self.commit(next)?;
        self.loaded.remove(&tab);
        remove_columns(&self.dir, tab);
        Ok(self.list())
    }

    /// Renames the tab to `name` trimmed; a name that trims to nothing keeps the old one.
    pub fn rename_tab(&mut self, tab: TabId, name: &str) -> Result<TabList> {
        let mut next = self.index.clone();
        let stored = next.tab_mut(tab)?;
        let name = name.trim();
        if !name.is_empty() {
            name.clone_into(&mut stored.name);
        }
        self.commit(next)?;
        Ok(self.list())
    }

    /// Sets the tab's language.
    pub fn set_language(&mut self, tab: TabId, language: TabLanguage) -> Result<TabList> {
        let mut next = self.index.clone();
        next.tab_mut(tab)?.language = language;
        self.commit(next)?;
        Ok(self.list())
    }

    /// Shows the tab.
    pub fn show_tab(&mut self, tab: TabId) -> Result<TabList> {
        let mut next = self.index.clone();
        next.require_tab(tab)?;
        next.shown = tab;
        self.commit(next)?;
        Ok(self.list())
    }

    /// Writes `next` when it differs from the index in memory, then keeps it; a failed write keeps the old one.
    fn commit(&mut self, next: Index) -> Result<()> {
        if next != self.index {
            write_index(&self.index_path(), &next)?;
            self.index = next;
        }
        Ok(())
    }

    fn index_path(&self) -> PathBuf {
        self.dir.join(INDEX_FILE)
    }

    fn list(&self) -> TabList {
        let tabs = self
            .index
            .tabs
            .iter()
            .map(|stored| TabEntry {
                id: stored.id,
                name: stored.name.clone(),
                language: stored.language.clone(),
                holds_text: self.loaded.get(&stored.id).map_or_else(
                    || has_text_on_disk(&self.dir, stored.id),
                    LoadedTab::holds_text,
                ),
            })
            .collect();
        TabList {
            tabs,
            shown: self.index.shown,
        }
    }
}

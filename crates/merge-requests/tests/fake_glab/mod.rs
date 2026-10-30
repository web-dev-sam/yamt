use std::fs;
use std::path::{Path, PathBuf};

use yamt_conflict_repo::TempDir;
use yamt_gitio::Glab;

pub fn in_this_repository(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(relative)
}

/// The fake glab on a scenario through a symlink `glab` beside its `glab.env`, never a file written here
/// (ETXTBSY); the log lives beside it (`tests/glab/README.md`).
pub struct Fake {
    pub dir: TempDir,
    pub glab: Glab,
}

impl Fake {
    pub fn new(scenario: &str) -> Fake {
        let dir = tempfile::tempdir().unwrap();
        let settings = format!(
            "YAMT_FAKE_GLAB={}\nYAMT_FAKE_GLAB_LOG={}\n",
            in_this_repository(&format!("tests/glab/{scenario}")).display(),
            dir.path().join("log").display(),
        );
        fs::write(dir.path().join("glab.env"), settings).unwrap();
        let link = dir.path().join("glab");
        std::os::unix::fs::symlink(in_this_repository("scripts/fake-glab/glab"), &link).unwrap();
        Fake {
            glab: Glab::at(link),
            dir,
        }
    }

    pub fn logged(&self, prefix: &str) -> Vec<String> {
        let log = fs::read_to_string(self.dir.path().join("log")).unwrap_or_default();
        let lines = log.lines().filter(|line| line.starts_with(prefix));
        lines.map(str::to_owned).collect()
    }
}

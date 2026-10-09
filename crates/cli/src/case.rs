use std::fs;
use std::path::{Path, PathBuf};

use crate::{Error, Result};

const EXPECTED_FILE: &str = "expected.json";

pub(crate) struct Case {
    pub(crate) name: String,
    pub(crate) dir: PathBuf,
    pub(crate) extension: String,
    pub(crate) base: String,
    pub(crate) local: String,
    pub(crate) remote: String,
}

#[derive(Default)]
struct SideExtensions {
    base: Option<String>,
    local: Option<String>,
    remote: Option<String>,
}

impl Case {
    pub(crate) fn load(dir: &Path) -> Result<Case> {
        let name = dir
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| malformed(&dir.display().to_string(), "it has no UTF-8 directory name"))?
            .to_owned();
        let extension = side_extension(dir, &name)?;
        let read_side = |side: &str| read_text(&dir.join(format!("{side}.{extension}")));
        Ok(Case {
            base: read_side("base")?,
            local: read_side("local")?,
            remote: read_side("remote")?,
            name,
            dir: dir.to_path_buf(),
            extension,
        })
    }

    pub(crate) fn expected_path(&self) -> PathBuf {
        self.dir.join(EXPECTED_FILE)
    }
}

fn side_extension(dir: &Path, case: &str) -> Result<String> {
    let mut found = SideExtensions::default();
    for entry in fs::read_dir(dir).map_err(|source| read_error(dir, source))? {
        let file_name = entry.map_err(|source| read_error(dir, source))?.file_name();
        let Some((side, extension)) = file_name.to_str().and_then(|name| name.split_once('.'))
        else {
            continue;
        };
        let slot = match side {
            "base" => &mut found.base,
            "local" => &mut found.local,
            "remote" => &mut found.remote,
            _ => continue,
        };
        if slot.replace(extension.to_owned()).is_some() {
            return Err(malformed(case, &format!("more than one {side}.*")));
        }
    }
    let base = found
        .base
        .ok_or_else(|| malformed(case, "missing base.*"))?;
    let local = found
        .local
        .ok_or_else(|| malformed(case, "missing local.*"))?;
    let remote = found
        .remote
        .ok_or_else(|| malformed(case, "missing remote.*"))?;
    if local != base || remote != base {
        let problem = format!("base.{base}, local.{local} and remote.{remote} differ in extension");
        return Err(malformed(case, &problem));
    }
    Ok(base)
}

pub(crate) fn read_text(path: &Path) -> Result<String> {
    fs::read_to_string(path).map_err(|source| read_error(path, source))
}

pub(crate) fn read_error(path: &Path, source: std::io::Error) -> Error {
    Error::Read {
        path: path.display().to_string(),
        source,
    }
}

fn malformed(case: &str, problem: &str) -> Error {
    Error::MalformedCase {
        case: case.to_owned(),
        problem: problem.to_owned(),
    }
}

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use crate::Error;
use crate::file;

const FOLDER: &str = "yamt";
const DEFAULT_FILE: &str = "settings.json";
const LOCATION_FILE: &str = "settings-location";
const HOME_PREFIX: &str = "~/";

#[derive(Clone, Debug)]
pub struct Places {
    default_file: PathBuf,
    location_file: PathBuf,
    home: PathBuf,
}

impl Places {
    /// `config_dir` = the platform's per-user config folder; files go in `<config_dir>/yamt/`.
    #[must_use]
    pub fn new(config_dir: &Path, home: &Path) -> Places {
        let folder = config_dir.join(FOLDER);
        Places {
            default_file: folder.join(DEFAULT_FILE),
            location_file: folder.join(LOCATION_FILE),
            home: home.to_owned(),
        }
    }

    #[must_use]
    pub fn default_file(&self) -> &Path {
        &self.default_file
    }

    pub(crate) fn file_in_use(&self) -> Result<PathBuf, Error> {
        let text = match fs::read_to_string(&self.location_file) {
            Ok(text) => text,
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Ok(self.default_file.clone());
            }
            Err(error) => {
                return Err(Error::ReadFailed {
                    path: self.location_file.clone(),
                    message: error.to_string(),
                });
            }
        };
        let recorded = PathBuf::from(text.trim_end_matches(['\n', '\r']));
        if recorded.is_absolute() {
            Ok(recorded)
        } else {
            Err(Error::Broken {
                path: self.location_file.clone(),
                message: format!("`{}` is not an absolute path", recorded.display()),
            })
        }
    }

    pub(crate) fn expanded(&self, to: &str) -> Result<PathBuf, Error> {
        if let Some(below_home) = to.strip_prefix(HOME_PREFIX) {
            return Ok(self.home.join(below_home));
        }
        let path = PathBuf::from(to);
        if path.is_absolute() {
            Ok(path)
        } else {
            Err(Error::NotAbsolute {
                path: to.to_owned(),
            })
        }
    }

    pub(crate) fn record_location(&self, path: &Path) -> Result<(), Error> {
        if path != self.default_file {
            return file::write_text(&self.location_file, &format!("{}\n", path.display()));
        }
        match fs::remove_file(&self.location_file) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
            Err(error) => Err(Error::WriteFailed {
                path: self.location_file.clone(),
                message: error.to_string(),
            }),
        }
    }
}

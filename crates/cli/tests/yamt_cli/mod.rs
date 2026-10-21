use std::ffi::OsStr;
use std::path::Path;
use std::process::Command;

pub struct Output {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

pub fn yamt_cli<S: AsRef<OsStr>>(args: &[S]) -> Output {
    let output = Command::new(env!("CARGO_BIN_EXE_yamt-cli"))
        .args(args)
        .output()
        .unwrap();
    Output {
        code: output.status.code().unwrap(),
        stdout: String::from_utf8(output.stdout).unwrap(),
        stderr: String::from_utf8(output.stderr).unwrap(),
    }
}

pub fn path(path: &Path) -> &str {
    path.to_str().unwrap()
}

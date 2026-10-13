use std::env;
use std::error::Error;
use std::path::PathBuf;

const MANIFEST_FILE: &str = "windows-app-manifest.xml";

fn main() -> Result<(), Box<dyn Error>> {
    if !is_windows_msvc_target() {
        tauri_build::build();
        return Ok(());
    }
    // tauri-build links its app manifest into the bins only; a test binary linking tauri then dies at load with
    // STATUS_ENTRYPOINT_NOT_FOUND (tauri-apps/tauri#13419). Workaround from tauri's examples/api/src-tauri/build.rs.
    let windows = tauri_build::WindowsAttributes::new_without_app_manifest();
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))?;
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR")?).join(MANIFEST_FILE);
    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    Ok(())
}

fn is_windows_msvc_target() -> bool {
    env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
}

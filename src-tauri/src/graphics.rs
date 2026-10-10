use std::env;
use std::ffi::OsStr;
use std::path::Path;

const DMABUF_VAR: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";
// Present while the proprietary NVIDIA kernel module is loaded; WebKitGTK's DMA-BUF renderer then
// fails on Wayland (https://v2.tauri.app/develop/debug/linux-graphics/).
const NVIDIA_MODULE: &str = "/sys/module/nvidia";

#[expect(
    unsafe_code,
    reason = "std::env::set_var needs it since edition 2024; the one allowed site (plan §2 #43)"
)]
pub(crate) fn disable_dmabuf_on_nvidia() {
    if needs_dmabuf_disabled(env::var_os(DMABUF_VAR).as_deref(), Path::new(NVIDIA_MODULE)) {
        // SAFETY: no other thread exists yet: `run()` calls this before Tauri, GTK or logging start.
        unsafe { env::set_var(DMABUF_VAR, "1") };
    }
}

fn needs_dmabuf_disabled(current: Option<&OsStr>, nvidia_module: &Path) -> bool {
    current.is_none() && nvidia_module.exists()
}

#[cfg(test)]
mod tests {
    use yamt_conflict_repo::TempDir;

    use super::*;

    #[test]
    fn nvidia_module_without_the_variable_disables_dmabuf() {
        let sys_module = TempDir::new().unwrap();
        assert!(needs_dmabuf_disabled(None, sys_module.path()));
    }

    #[test]
    fn a_user_value_is_respected_even_when_it_is_zero() {
        let sys_module = TempDir::new().unwrap();
        for value in ["1", "0"] {
            assert!(
                !needs_dmabuf_disabled(Some(OsStr::new(value)), sys_module.path()),
                "{value}"
            );
        }
    }

    #[test]
    fn without_the_nvidia_module_nothing_changes() {
        let sys_module = TempDir::new().unwrap();
        let absent = sys_module.path().join("nvidia");
        assert!(!needs_dmabuf_disabled(None, &absent));
    }
}

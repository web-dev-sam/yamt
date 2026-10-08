//! Desktop shell: thin Tauri commands and the IPC types exported to the frontend.
#![forbid(unsafe_code)]

#[derive(specta::Type)]
pub struct Ping {
    pub ok: bool,
}

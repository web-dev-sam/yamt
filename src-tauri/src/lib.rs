//! Desktop shell: IPC types exported to the frontend, and later the Tauri commands.
#![forbid(unsafe_code)]

#[derive(specta::Type)]
pub struct Ping {
    pub ok: bool,
}

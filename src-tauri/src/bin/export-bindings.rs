use std::path::PathBuf;

use specta::Types;
use specta_typescript::Typescript;
use yamt_app::Ping;

const BINDINGS_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../frontend/src/ipc/bindings.ts"
);

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let out = std::env::args_os()
        .nth(1)
        .map_or_else(|| PathBuf::from(BINDINGS_PATH), PathBuf::from);
    let types = Types::default().register::<Ping>();
    Typescript::default().export_to(&out, &types, specta_serde::Format)?;
    Ok(())
}

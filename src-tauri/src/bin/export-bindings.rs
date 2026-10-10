use std::path::PathBuf;

const BINDINGS_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../frontend/src/ipc/bindings.ts"
);

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let out = std::env::args_os()
        .nth(1)
        .map_or_else(|| PathBuf::from(BINDINGS_PATH), PathBuf::from);
    yamt_app::export_bindings(&out)?;
    Ok(())
}

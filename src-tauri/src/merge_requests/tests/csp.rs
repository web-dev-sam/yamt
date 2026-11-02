use super::*;

const IMAGE_SOURCES: [&str; 6] = [
    "'self'",
    "data:",
    "yamt-picture:",
    "http://yamt-picture.localhost",
    "https://secure.gravatar.com",
    "https://www.gravatar.com",
];

/// The sources of the `img-src` directive of `policy`.
fn image_sources(policy: &str) -> Vec<&str> {
    let directive = policy
        .split(';')
        .map(str::trim)
        .find_map(|directive| directive.strip_prefix("img-src "));
    directive.unwrap().split_whitespace().collect()
}

#[test]
fn the_csp_admits_the_scheme_and_gravatars_two_hosts_only() {
    let config =
        std::fs::read(Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json")).unwrap();
    let config: Value = serde_json::from_slice(&config).unwrap();
    let security = &config["app"]["security"];

    for key in ["csp", "devCsp"] {
        let policy = security[key].as_str().unwrap();
        assert_eq!(image_sources(policy), IMAGE_SOURCES, "{key}");
        assert_eq!(policy.matches("img-src").count(), 1, "{key}");
    }
    assert_eq!(PICTURE_SCHEME, "yamt-picture");
}

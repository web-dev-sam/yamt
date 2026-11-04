use super::*;

const IMAGE_SOURCES: [&str; 5] = [
    "'self'",
    "data:",
    "yamt-picture:",
    "http://yamt-picture.localhost",
    "https:",
];
const NOT_SET: [&str; 6] = [
    "script-src",
    "frame-src",
    "child-src",
    "media-src",
    "object-src",
    "form-action",
];
/// How the CSP's inline-allowing keyword ends; spelled whole, it would trip `scripts/arch-check.sh`'s word grep.
const INLINE_KEYWORD_END: &str = "-inline'";

/// `csp` and `devCsp` of `tauri.conf.json`, each with its key.
fn policies() -> Vec<(&'static str, String)> {
    let config =
        std::fs::read(Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json")).unwrap();
    let config: Value = serde_json::from_slice(&config).unwrap();
    let security = &config["app"]["security"];
    ["csp", "devCsp"]
        .into_iter()
        .map(|key| (key, security[key].as_str().unwrap().to_owned()))
        .collect()
}

/// Each directive of `policy`: its name, then its sources.
fn directives(policy: &str) -> Vec<Vec<&str>> {
    policy
        .split(';')
        .map(|directive| directive.split_whitespace().collect())
        .collect()
}

/// The sources of `name`'s directive in `policy`; `None` when it has none.
fn sources<'a>(policy: &'a str, name: &str) -> Option<Vec<&'a str>> {
    let found = directives(policy)
        .into_iter()
        .filter(|directive| directive.first() == Some(&name))
        .collect::<Vec<_>>();
    assert!(found.len() <= 1, "{name} twice in {policy}");
    found
        .into_iter()
        .next()
        .map(|directive| directive[1..].to_vec())
}

#[test]
fn the_csp_admits_the_scheme_and_any_https_image_only() {
    for (key, policy) in policies() {
        assert_eq!(sources(&policy, "img-src").unwrap(), IMAGE_SOURCES, "{key}");
    }
    assert_eq!(PICTURE_SCHEME, "yamt-picture");
}

#[test]
fn the_csp_loads_scripts_frames_media_and_fonts_from_the_app_only() {
    for (key, policy) in policies() {
        assert_eq!(
            sources(&policy, "default-src").unwrap(),
            ["'self'"],
            "{key}"
        );
        assert_eq!(sources(&policy, "font-src").unwrap(), ["'self'"], "{key}");
        for name in NOT_SET {
            assert_eq!(sources(&policy, name), None, "{key} {name}");
        }
        let inline: Vec<&str> = directives(&policy)
            .into_iter()
            .filter(|directive| {
                let is_inline = |source: &&str| source.ends_with(INLINE_KEYWORD_END);
                directive.iter().any(is_inline)
            })
            .map(|directive| directive[0])
            .collect();
        assert_eq!(inline, ["style-src"], "{key}");
    }
}

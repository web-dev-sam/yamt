use super::*;

const ORIGIN: &str = "https://gitlab.example";
const AVATAR_PATH: &str = "/uploads/-/system/user/avatar/2/avatar.png";
const SHA256: &str = "f660ab912ec121d1b1e928a0bb4bc61b15f5ad44d5efdc4e1c92a25e99b8e44a";
const MD5: &str = "205e460b479e2e5b48aec07710c08d50";

fn source(avatar_url: &str) -> AvatarSource {
    avatar_source(Some(ORIGIN), Some(avatar_url))
}

fn uploaded(address: &str) -> AvatarSource {
    AvatarSource::Uploaded(PictureAddress(address.to_owned()))
}

fn gravatar(address: &str) -> AvatarSource {
    AvatarSource::Gravatar(GravatarAddress(address.to_owned()))
}

#[test]
fn only_an_uploaded_avatar_on_the_projects_origin_is_an_uploaded_address() {
    let absolute = format!("{ORIGIN}{AVATAR_PATH}");
    assert_eq!(source(AVATAR_PATH), uploaded(&absolute));
    assert_eq!(source(&absolute), uploaded(&absolute));
    let queried = format!("{AVATAR_PATH}?v=1793647454&width=64");
    assert_eq!(source(&queried), uploaded(&format!("{ORIGIN}{queried}")));
    let sub_path = "/gitlab/uploads/-/system/user/avatar/2/a_b-c.d~e.jpg";
    assert_eq!(source(sub_path), uploaded(&format!("{ORIGIN}{sub_path}")));

    let refused = [
        format!("http://gitlab.example{AVATAR_PATH}"),
        format!("https://other.example{AVATAR_PATH}"),
        format!("https://gitlab.example.other.example{AVATAR_PATH}"),
        format!("https://gitlab.example:8443{AVATAR_PATH}"),
        format!("//other.example{AVATAR_PATH}"),
        "/uploads/-/system/user/avatar/2/../../../../etc/passwd".to_owned(),
        "/../uploads/-/system/user/avatar/2/avatar.png".to_owned(),
        "/uploads/-/system/user/avatar/2/..".to_owned(),
        "/uploads/-/system/user/avatar/two/avatar.png".to_owned(),
        "/uploads/-/system/user/avatar//avatar.png".to_owned(),
        "/uploads/-/system/user/avatar/2/".to_owned(),
        "/uploads/-/system/user/avatar/2".to_owned(),
        "/uploads/-/system/user/avatar/2/sub/avatar.png".to_owned(),
        "/uploads/-/system/group/avatar/2/avatar.png".to_owned(),
        "/uploads/-/system/user/avatar/2/a%2fb.png".to_owned(),
        "uploads/-/system/user/avatar/2/avatar.png".to_owned(),
        "/a b/uploads/-/system/user/avatar/2/avatar.png".to_owned(),
        format!("{AVATAR_PATH}?v=1%20"),
        format!("{AVATAR_PATH}?v=<script>"),
        "/assets/no_avatar.png".to_owned(),
        String::new(),
    ];
    for avatar_url in refused {
        assert_eq!(source(&avatar_url), AvatarSource::None, "{avatar_url}");
    }
    assert_eq!(avatar_source(None, Some(AVATAR_PATH)), AvatarSource::None);
    assert_eq!(avatar_source(Some(ORIGIN), None), AvatarSource::None);
}

#[test]
fn an_uploaded_avatar_keeps_the_port_of_a_project_on_one() {
    let origin = "https://gitlab.example:8443";
    let absolute = format!("{origin}{AVATAR_PATH}");

    assert_eq!(
        avatar_source(Some(origin), Some(AVATAR_PATH)),
        uploaded(&absolute)
    );
    assert_eq!(
        avatar_source(Some(origin), Some(&absolute)),
        uploaded(&absolute)
    );
    let portless = format!("{ORIGIN}{AVATAR_PATH}");
    assert_eq!(
        avatar_source(Some(origin), Some(&portless)),
        AvatarSource::None
    );
}

#[test]
fn only_gravatars_avatar_path_on_its_two_hosts_is_a_gravatar_address() {
    let accepted = [
        format!("https://secure.gravatar.com/avatar/{SHA256}?s=80&d=identicon"),
        format!("https://www.gravatar.com/avatar/{SHA256}?s=80&d=identicon"),
        format!("https://secure.gravatar.com/avatar/{MD5}"),
        format!("https://www.gravatar.com/avatar/{}", MD5.to_uppercase()),
        format!("https://secure.gravatar.com/avatar/{MD5}?d=https%3A%2F%2Fx.example&s=40"),
    ];
    for address in accepted {
        assert_eq!(source(&address), gravatar(&address), "{address}");
        assert_eq!(avatar_source(None, Some(&address)), gravatar(&address));
    }

    let refused = [
        format!("http://secure.gravatar.com/avatar/{SHA256}"),
        format!("http://www.gravatar.com/avatar/{SHA256}"),
        format!("https://gravatar.com/avatar/{SHA256}"),
        format!("https://secure.gravatar.com.example/avatar/{SHA256}"),
        format!("https://secure.gravatar.community/avatar/{SHA256}"),
        format!("https://www.gravatar.com:8443/avatar/{SHA256}"),
        format!("https://secure.gravatar.com/profile/{SHA256}"),
        format!("https://secure.gravatar.com/avatar/{SHA256}/x"),
        format!("https://secure.gravatar.com/avatar/{}", &SHA256[1..]),
        format!("https://secure.gravatar.com/avatar/{}", &MD5[1..]),
        format!("https://secure.gravatar.com/avatar/{MD5}0"),
        format!("https://secure.gravatar.com/avatar/{}g", &MD5[1..]),
        format!("https://seccdn.libravatar.org/avatar/{SHA256}?s=80&d=identicon"),
        format!("https://secure.gravatar.com/avatar/{SHA256}?s=80&d=identicon\"onerror"),
        format!("https://secure.gravatar.com/avatar/{SHA256}?s=80#x"),
        format!("https://secure.gravatar.com/avatar/{SHA256}?s= 80"),
    ];
    for address in refused {
        assert_eq!(source(&address), AvatarSource::None, "{address}");
    }
}

#[test]
fn a_picture_that_is_not_png_jpeg_gif_or_webp_is_refused() {
    let kind_of = |bytes: &[u8]| picture_from(bytes.to_vec()).map(|picture| picture.kind);
    let png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];
    assert_eq!(kind_of(&png), Ok(ImageKind::Png));
    assert_eq!(kind_of(&[0xFF, 0xD8, 0xFF, 0xE0]), Ok(ImageKind::Jpeg));
    assert_eq!(kind_of(b"GIF89a"), Ok(ImageKind::Gif));
    assert_eq!(kind_of(b"GIF87a"), Ok(ImageKind::Gif));
    assert_eq!(
        kind_of(b"RIFF\x24\x00\x00\x00WEBPVP8 "),
        Ok(ImageKind::Webp)
    );

    let not_an_image = Err(NOT_AN_IMAGE.to_owned());
    let refused: [&[u8]; 8] = [
        b"<!DOCTYPE html><html></html>",
        b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
        &png[..7],
        &[0xFF, 0xD8],
        b"GIF",
        b"RIFF\x24\x00\x00\x00WAVEfmt ",
        b"RIFF\x24\x00\x00\x00WEB",
        b"",
    ];
    for bytes in refused {
        assert_eq!(kind_of(bytes), not_an_image, "{bytes:?}");
    }
    assert_eq!(kind_of(b"xRIFF\x24\x00\x00WEBP"), not_an_image);
}

#[test]
fn a_picture_over_one_mib_is_refused() {
    let mut bytes = PNG_START.to_vec();
    bytes.resize(MAX_PICTURE_BYTES, 0);
    let largest = picture_from(bytes.clone()).unwrap();
    assert_eq!(largest.bytes, bytes);

    bytes.push(0);
    assert_eq!(picture_from(bytes), Err(TOO_LARGE.to_owned()));
    assert_eq!(MAX_PICTURE_BYTES, 1024 * 1024);
}

#[test]
fn each_kind_names_its_media_type() {
    let kinds = [
        ImageKind::Png,
        ImageKind::Jpeg,
        ImageKind::Gif,
        ImageKind::Webp,
    ];
    let mimes = kinds.map(ImageKind::mime);
    assert_eq!(
        mimes,
        ["image/png", "image/jpeg", "image/gif", "image/webp"]
    );
}

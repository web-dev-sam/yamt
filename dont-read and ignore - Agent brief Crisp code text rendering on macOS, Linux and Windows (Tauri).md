# Agent brief: Crisp code text rendering on macOS, Linux and Windows (Tauri)

Oct 13, 2026 · @Samuel

Make the code text in our Tauri 3-way merge tool render as crisply as WebStorm on macOS and Linux, and add a Windows build that does the same. Investigate, plan and implement the fix yourself; what follows is what we know so far.

## The issue

The app shows three CodeMirror 6 editors using JetBrains Mono at the same size and weight as WebStorm. Side by side, our text looks softer, slightly janky and less legible than WebStorm's, even though the font settings match.

## What we found

- **Antialiasing differs.** At 400%+ zoom, WebStorm's glyphs have colored subpixel fringes; ours are pure grayscale. This is the main visible difference.
- **It is not our CSS.** Web Inspector's Layers panel shows the code text is not on its own composited layer. The grayscale comes from the webview engine's text rendering path.
- **macOS (WKWebView):** macOS removed subpixel font smoothing in 10.14, so WKWebView cannot produce it. WebStorm only gets fringes because JetBrains Runtime rasterizes text itself. Here the realistic goal is matching stroke weight and contrast.
- **Linux (WebKitGTK):** the default GPU/compositing path rasterizes text in grayscale. The CPU rendering path (`WEBKIT_SKIA_ENABLE_CPU_RENDERING=1` on 2.46+, `WEBKIT_DISABLE_COMPOSITING_MODE=1` on older versions) may honor fontconfig subpixel settings. This is unverified and may cost scrolling performance.
- **Fractional scaling:** our screenshots show about 1.45 device pixels per CSS pixel. GTK3 (used by Tauri on Linux) does not support fractional scaling on Wayland, so the compositor downscales a 2x render, which softens text further. Fractional line heights and font sizes can also put baselines on fractional pixels on any platform.
- **Windows (WebView2):** there is no Windows build yet. Chromium-based WebView2 renders ClearType text as long as every layer holding text is opaque and pixel-aligned (no window transparency, opaque scroll containers and sticky gutters, no transforms on text), so this is the one platform where we can likely match WebStorm exactly.

## What we expect from you

Fix it where the platform allows, compensate where it does not, and add the Windows build target with CI. Compare zoomed screenshots against WebStorm before and after each change, don't regress scrolling performance, put any engine-level hacks behind a setting, and write down what turned out to be impossible on each platform.

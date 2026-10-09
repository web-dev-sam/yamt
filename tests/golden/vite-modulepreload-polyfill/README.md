# vite-modulepreload-polyfill

- Project: vitejs/vite (MIT, https://github.com/vitejs/vite/blob/f607e0b624b9c2fcbefb3df33ba712238a81cd57/LICENSE)
- Merge commit: f607e0b624b9c2fcbefb3df33ba712238a81cd57 (https://github.com/vitejs/vite/commit/f607e0b624b9c2fcbefb3df33ba712238a81cd57) — parents: ours 6f99a1c6a8735a5820f8e448f477965554463780, theirs 946831f986cb797009b8178659d2b31f570c44ff; merge base bdde0f9e5077ca1a21a04eefc30abad055047226
- File: packages/vite/src/node/plugins/modulePreloadPolyfill.ts
- Lines (base/local/remote): 107/121/106
- Why this case: Three regions changed identically on both sides, a conflict in the import block where both sides add the same first line, and a local-only insertion.

## Compare in PhpStorm

    scripts/golden-repo.sh vite-modulepreload-polyfill /tmp/yamt-golden/vite-modulepreload-polyfill
    # then open /tmp/yamt-golden/vite-modulepreload-polyfill in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/vite-modulepreload-polyfill/local.ts tests/golden/vite-modulepreload-polyfill/remote.ts tests/golden/vite-modulepreload-polyfill/base.ts /tmp/yamt-vite-modulepreload-polyfill-result.ts

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/vite-modulepreload-polyfill/base.ts tests/golden/vite-modulepreload-polyfill/local.ts tests/golden/vite-modulepreload-polyfill/remote.ts

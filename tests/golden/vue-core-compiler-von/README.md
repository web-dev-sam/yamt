# vue-core-compiler-von

- Project: vuejs/core (MIT, https://github.com/vuejs/core/blob/594cb1412d4a20e6900741c2d5d511c3b43cd173/LICENSE)
- Merge commit: 594cb1412d4a20e6900741c2d5d511c3b43cd173 (https://github.com/vuejs/core/commit/594cb1412d4a20e6900741c2d5d511c3b43cd173) — parents: ours 30583b9ee1c696d3cb836f0bfd969793e57e849d, theirs 9a36f2a0b8a01e19cb58b3b5870eb906ab84d001; merge base 23e098807ba026946fd4706be569b3d170462616
- File: packages/compiler-core/src/transforms/vOn.ts
- Lines (base/local/remote): 183/183/180
- Why this case: A remote-only change 2 unchanged lines above a conflict (remote deletes 3 lines, local edits the first of them) and a far remote-only change.

## Compare in PhpStorm

    scripts/golden-repo.sh vue-core-compiler-von /tmp/yamt-golden/vue-core-compiler-von
    # then open /tmp/yamt-golden/vue-core-compiler-von in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/vue-core-compiler-von/local.ts tests/golden/vue-core-compiler-von/remote.ts tests/golden/vue-core-compiler-von/base.ts /tmp/yamt-vue-core-compiler-von-result.ts

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/vue-core-compiler-von/base.ts tests/golden/vue-core-compiler-von/local.ts tests/golden/vue-core-compiler-von/remote.ts

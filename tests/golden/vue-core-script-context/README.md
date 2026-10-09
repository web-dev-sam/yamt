# vue-core-script-context

- Project: vuejs/core (MIT, https://github.com/vuejs/core/blob/05ffb24c86a08c318eee51af1099a317e9561668/LICENSE)
- Merge commit: 05ffb24c86a08c318eee51af1099a317e9561668 (https://github.com/vuejs/core/commit/05ffb24c86a08c318eee51af1099a317e9561668) — parents: ours fcc15898b7d5660eafcb45a2c9134159b467c3f9, theirs f279a1767e24965e672cd4ff6e3006e76e5cd8b3; merge base 8bff142f99b646e9dd15897ec75368fbf34f1534
- File: packages/compiler-sfc/src/script/context.ts
- Lines (base/local/remote): 208/206/201
- Why this case: The same import inserted identically on both sides, a conflict whose remote side equals the tail of the local side, and a local-only change 2 unchanged lines below it.

## Compare in PhpStorm

    scripts/golden-repo.sh vue-core-script-context /tmp/yamt-golden/vue-core-script-context
    # then open /tmp/yamt-golden/vue-core-script-context in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/vue-core-script-context/local.ts tests/golden/vue-core-script-context/remote.ts tests/golden/vue-core-script-context/base.ts /tmp/yamt-vue-core-script-context-result.ts

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/vue-core-script-context/base.ts tests/golden/vue-core-script-context/local.ts tests/golden/vue-core-script-context/remote.ts

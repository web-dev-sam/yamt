# vue-core-playground-app

- Project: vuejs/core (MIT, https://github.com/vuejs/core/blob/bc8bd6852c6727389d0852ae8db86acf9ea992de/LICENSE)
- Merge commit: bc8bd6852c6727389d0852ae8db86acf9ea992de (https://github.com/vuejs/core/commit/bc8bd6852c6727389d0852ae8db86acf9ea992de) — parents: ours 9ab65a1e443c3a87f60fb628193ece792cbdccfc, theirs d63616ca17de965ed32dcb449a4c5cd9982f15d2; merge base d2c458be2542a628878cbfbdfebcb53b65d3e9f3
- File: packages-private/sfc-playground/src/App.vue
- Lines (base/local/remote): 204/219/207
- Why this case: A pure insertion at the same place on both sides (one line each, different text) 1 unchanged line below a local-only one-line change, plus five more local-only regions and one remote-only insertion.

## Compare in PhpStorm

    scripts/golden-repo.sh vue-core-playground-app /tmp/yamt-golden/vue-core-playground-app
    # then open /tmp/yamt-golden/vue-core-playground-app in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/vue-core-playground-app/local.vue tests/golden/vue-core-playground-app/remote.vue tests/golden/vue-core-playground-app/base.vue /tmp/yamt-vue-core-playground-app-result.vue

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/vue-core-playground-app/base.vue tests/golden/vue-core-playground-app/local.vue tests/golden/vue-core-playground-app/remote.vue

# vue-router-playground-app

- Project: vuejs/router (MIT, https://github.com/vuejs/router/blob/db036a52360d9b9478952ec18a01c82a87b7596a/LICENSE)
- Merge commit: db036a52360d9b9478952ec18a01c82a87b7596a (https://github.com/vuejs/router/commit/db036a52360d9b9478952ec18a01c82a87b7596a) — parents: ours 1191594e9a95cb855d31046ae0df0443c65cadbf, theirs 8c73877dc159fb7d736f9d0a71ba22e8130012a3; merge base 1bbf2a990c0e57e214128b55eb0eb3c4b07391cc
- File: packages/playground/src/App.vue
- Lines (base/local/remote): 233/205/219
- Why this case: A 49-line conflict (local deletes a block that remote rewrites) 2 unchanged lines below a 20-line local-only change, plus other one-sided changes on both sides.

## Compare in PhpStorm

    scripts/golden-repo.sh vue-router-playground-app /tmp/yamt-golden/vue-router-playground-app
    # then open /tmp/yamt-golden/vue-router-playground-app in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/vue-router-playground-app/local.vue tests/golden/vue-router-playground-app/remote.vue tests/golden/vue-router-playground-app/base.vue /tmp/yamt-vue-router-playground-app-result.vue

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/vue-router-playground-app/base.vue tests/golden/vue-router-playground-app/local.vue tests/golden/vue-router-playground-app/remote.vue

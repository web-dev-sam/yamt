# nuxt-island-test

- Project: nuxt/nuxt (MIT, https://github.com/nuxt/nuxt/blob/68a4d3b4ce27ecbba04dc1c91c1803bb38acfbce/LICENSE)
- Merge commit: 68a4d3b4ce27ecbba04dc1c91c1803bb38acfbce (https://github.com/nuxt/nuxt/commit/68a4d3b4ce27ecbba04dc1c91c1803bb38acfbce) — parents: ours acc23a0b72bce7a56af44e66e4453321c16ca3db, theirs 4fbbc10f62aae02beb0c59e946c5fd18cd0d63f3; merge base bb533f8d253fcfb67937ee811bc8a49cd81239e8
- File: test/nuxt/nuxt-island.test.ts
- Lines (base/local/remote): 68/214/241
- Why this case: The remote side has no final newline; both sides insert at the same places (imports, mocks, end of file), giving three conflicts, one of them 140 lines long.

## Compare in PhpStorm

    scripts/golden-repo.sh nuxt-island-test /tmp/yamt-golden/nuxt-island-test
    # then open /tmp/yamt-golden/nuxt-island-test in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/nuxt-island-test/local.ts tests/golden/nuxt-island-test/remote.ts tests/golden/nuxt-island-test/base.ts /tmp/yamt-nuxt-island-test-result.ts

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/nuxt-island-test/base.ts tests/golden/nuxt-island-test/local.ts tests/golden/nuxt-island-test/remote.ts

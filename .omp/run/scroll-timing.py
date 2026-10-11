#!/usr/bin/env python3
"""Scroll frame timing of the real yamt app, driven through tauri-driver.

Measures how often the window paints while a pane scrolls: 200 steps of 40 px, one step per
animation frame, from the top of the file. A frame over 20 ms misses a 60 Hz frame.

Setup (any display; the owner's own screen gives his numbers, a private Xvfb display works too):
    cargo tauri build --debug --no-bundle
    ~/.cargo/bin/tauri-driver --port 4754 --native-port 4755          # real display
    # or: Xvfb :91 -screen 0 1920x1080x24 & env -u WAYLAND_DISPLAY DISPLAY=:91 GDK_BACKEND=x11 tauri-driver ...
    repo: git clone --no-checkout ~/yamt-trial/vue-merge-yamt <dir>; cd <dir>;
          git checkout -B vapor origin/vapor; git branch minor origin/minor; git merge minor

Run:
    .omp/run/scroll-timing.py --driver http://127.0.0.1:4754 --app target/debug/yamt --repo <dir>

Scenarios per target file: "1 opened" (fresh window, the target opened; the first file in the list
is open too because the window opens it at start) and "all opened" (every file in the list opened
once, then back to the target). The rows the owner cares about are "all opened": every file opened
in a session stays alive.
"""
import argparse
import json
import statistics
import time
import urllib.error
import urllib.request

TARGETS = ["packages/runtime-core/src/renderer.ts", "pnpm-lock.yaml"]
STEPS, STEP_PX, LATE_MS = 200, 40, 20

HARNESS = r"""
const [paneIndex, steps, px] = [arguments[0], arguments[1], arguments[2]];
const done = arguments[arguments.length - 1];
const editors = [...document.querySelectorAll('.cm-editor')]
  .filter((e) => e.checkVisibility({ visibilityProperty: true }));
if (editors.length !== 3) { done({ error: `expected 3 visible editors, found ${editors.length}` }); return; }
const pane = editors[paneIndex].querySelector('.cm-scroller');
pane.scrollTop = 0;
const gaps = [];
let last = 0, i = 0;
function step(t) {
  gaps.push(t - last); last = t;
  if (i++ >= steps) { done({ gaps: gaps.slice(1), editors: document.querySelectorAll('.cm-editor').length }); return; }
  pane.scrollTop += px;
  requestAnimationFrame(step);
}
setTimeout(() => requestAnimationFrame((t) => { last = t; requestAnimationFrame(step); }), 500);
"""


class Driver:
    def __init__(self, url):
        self.url = url
        self.sid = None

    def call(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(
            self.url + path, data=data, method=method, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                return json.loads(response.read())["value"]
        except urllib.error.HTTPError as error:
            raise RuntimeError(error.read().decode()[:2000]) from error

    def start(self, app, repo, width, height):
        capabilities = {"tauri:options": {"application": app, "args": ["--repo", repo]}}
        self.sid = self.call("POST", "/session", {"capabilities": {"alwaysMatch": capabilities}})["sessionId"]
        time.sleep(3)
        try:
            self.call("POST", f"/session/{self.sid}/window/rect", {"width": width, "height": height, "x": 0, "y": 0})
        except RuntimeError as error:
            print("window size not set:", error)

    def stop(self):
        if self.sid is not None:
            self.call("DELETE", f"/session/{self.sid}")
            self.sid = None

    def js(self, script, args=(), asynchronous=False):
        kind = "async" if asynchronous else "sync"
        return self.call("POST", f"/session/{self.sid}/execute/{kind}", {"script": script, "args": list(args)})

    def files(self):
        return self.js("return [...document.querySelectorAll('[role=option]')].map((e) => e.textContent.trim().split(/\\s/)[0])")

    def open(self, path):
        self.js(
            "const p = arguments[0]; [...document.querySelectorAll('[role=option]')]"
            ".find((e) => e.textContent.trim().startsWith(p)).click();",
            [path],
        )
        time.sleep(2.5)

    def scroll(self, pane):
        result = self.js(HARNESS, [pane, STEPS, STEP_PX], asynchronous=True)
        if "error" in result:
            raise RuntimeError(result["error"])
        gaps = sorted(result["gaps"])
        return {
            "mean": round(statistics.mean(gaps), 1),
            "p50": round(gaps[len(gaps) // 2], 1),
            "p95": round(gaps[int(len(gaps) * 0.95)], 1),
            "max": round(gaps[-1], 1),
            "late": sum(gap > LATE_MS for gap in gaps),
            "editors": result["editors"],
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--driver", default="http://127.0.0.1:4754")
    parser.add_argument("--app", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--targets", nargs="*", default=TARGETS)
    parser.add_argument("--panes", nargs="*", type=int, default=[1, 0], help="0 left, 1 middle, 2 right")
    parser.add_argument("--size", default="1600x1000")
    args = parser.parse_args()
    width, height = (int(n) for n in args.size.split("x"))
    driver = Driver(args.driver)
    rows = []
    for target in args.targets:
        for scenario in ("1 opened", "all opened"):
            driver.start(args.app, args.repo, width, height)
            try:
                if scenario == "all opened":
                    for path in driver.files():
                        driver.open(path)
                driver.open(target)
                for pane in args.panes:
                    rows.append((target.split("/")[-1], scenario, ["left", "middle", "right"][pane], driver.scroll(pane)))
            finally:
                driver.stop()
    print(f"| file | files opened | pane scrolled | mean ms | p50 | p95 | max | frames over {LATE_MS} ms (of {STEPS}) | editors alive |")
    print("|---|---|---|---|---|---|---|---|---|")
    for name, scenario, pane, s in rows:
        print(f"| {name} | {scenario} | {pane} | {s['mean']} | {s['p50']} | {s['p95']} | {s['max']} | {s['late']} | {s['editors']} |")


if __name__ == "__main__":
    main()

import { expect, test } from "vitest";

test("editor tests run inside a WebKit engine with layout", () => {
  const probe = document.createElement("div");
  probe.textContent = "yamt";
  document.body.append(probe);

  expect(navigator.userAgent).toContain("AppleWebKit");
  expect(navigator.userAgent).not.toContain("Chrome");
  expect(probe.getBoundingClientRect().height).toBeGreaterThan(0);

  probe.remove();
});

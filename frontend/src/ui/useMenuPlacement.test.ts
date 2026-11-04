import { expect, test } from "vitest";

import { besideLeft, useBesidePlacement } from "./useMenuPlacement";

test("a_panel_beside_its_anchor_ends_at_the_anchors_left_with_tops_level", () => {
  expect(besideLeft({ left: 800, top: 40 }, { width: 640, height: 768 })).toEqual({
    x: 160,
    y: 40,
  });
});

test("the_beside_placement_puts_an_unmeasured_panel_at_its_anchor", () => {
  const placement = useBesidePlacement(null, { left: 800, top: 40 });

  expect(placement.value).toEqual({ left: "800px", top: "40px" });
});

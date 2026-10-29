import type { Component } from "vue";
import PanelLeft from "~icons/lucide/panel-left";
import PanelLeftRightDashed from "~icons/lucide/panel-left-right-dashed";
import PanelRight from "~icons/lucide/panel-right";

import type { PaneIcon } from "./searching";

export const PANE_ICONS: Readonly<Record<PaneIcon, Component>> = {
  "panel-left": PanelLeft,
  "panel-left-right-dashed": PanelLeftRightDashed,
  "panel-right": PanelRight,
};

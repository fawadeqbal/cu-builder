"use client";

import { SegmentedControl } from "@cvb/ui";
import { VIEW_MODES, type ViewMode } from "@/lib/layout";

const ICONS: Record<ViewMode, string> = { editor: "list", split: "split", preview: "eye" };

type Props = {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  /** Phones have no room for split view, so it is left out there. */
  allowSplit: boolean;
};

/** Edit / Split / Preview: the design-system segmented control. */
export function ViewSwitcher({ mode, onMode, allowSplit }: Props) {
  const options = VIEW_MODES.filter((m) => allowSplit || m.id !== "split");
  const shown: ViewMode = !allowSplit && mode === "split" ? "editor" : mode;

  return (
    <SegmentedControl
      label="View"
      size="sm"
      value={shown}
      onChange={onMode}
      options={options.map((m) => ({
        value: m.id,
        icon: ICONS[m.id],
        label: (
          <span title={`${m.label} (${m.shortcut})`} data-mode={m.id}>
            {m.label}
          </span>
        ),
      }))}
    />
  );
}

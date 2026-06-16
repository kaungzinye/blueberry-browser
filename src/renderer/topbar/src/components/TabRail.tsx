import React from "react";
import { Plus, Sprout, X } from "lucide-react";
import { useBrowser } from "../contexts/BrowserContext";
import { Favicon } from "./Favicon";
import { cn } from "@common/lib/utils";

const getFavicon = (url: string): string | null => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
};

interface VerticalTabProps {
  title: string;
  favicon?: string | null;
  isActive: boolean;
  onClose: () => void;
  onActivate: () => void;
}

const VerticalTab: React.FC<VerticalTabProps> = ({
  title,
  favicon,
  isActive,
  onClose,
  onActivate,
}) => (
  <div
    onClick={() => !isActive && onActivate()}
    className={cn(
      "group/tab app-region-no-drag flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5",
      "transition-colors duration-150",
      isActive
        ? "bg-[#1f2c4d] text-[#e7ecf6]"
        : "text-[#94a3c2] hover:bg-white/[0.06] hover:text-[#e7ecf6]"
    )}
  >
    <Favicon src={favicon} />
    <span className="flex-1 truncate text-xs">{title || "New Tab"}</span>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className={cn(
        "flex-shrink-0 rounded-md p-1 transition-opacity hover:bg-white/10",
        "opacity-0 group-hover/tab:opacity-100",
        isActive && "opacity-100"
      )}
      aria-label="Close tab"
    >
      <X className="size-3" />
    </button>
  </div>
);

/**
 * Full-height, vertical, Arc-like tab rail (tabs only — no artifacts, no chat).
 * The top spacer clears the macOS traffic lights.
 */
export const TabRail: React.FC = () => {
  const { tabs, newTab, closeTab, switchTab } = useBrowser();

  // The Garden is active when it occupies the content slot — i.e. no tab is
  // the active slot occupant (get-tabs derives isActive from activeView).
  const gardenActive = !tabs.some((tab) => tab.isActive);

  return (
    <div className="app-region-drag flex h-full flex-col bg-[#0c1630] text-[#e7ecf6]">
      {/* macOS traffic-light clearance */}
      <div className="h-10 shrink-0" />

      {/* Pinned Garden home — returns the content slot to the canvas. */}
      <div className="app-region-no-drag px-2 pb-1">
        <div
          onClick={() => !gardenActive && window.topBarAPI?.showGarden()}
          className={cn(
            "group/garden flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5",
            "transition-colors duration-150",
            gardenActive
              ? "bg-[#1f2c4d] text-[#e7ecf6]"
              : "text-[#94a3c2] hover:bg-white/[0.06] hover:text-[#e7ecf6]"
          )}
        >
          <Sprout className="size-4 shrink-0 text-emerald-400" />
          <span className="flex-1 truncate text-xs font-medium">Garden</span>
        </div>
      </div>
      <div className="mx-3 mb-1 border-t border-white/10" />

      <div className="app-region-no-drag flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {tabs.map((tab) => (
          <VerticalTab
            key={tab.id}
            title={tab.title}
            favicon={getFavicon(tab.url)}
            isActive={tab.isActive}
            onClose={() => closeTab(tab.id)}
            onActivate={() => switchTab(tab.id)}
          />
        ))}
      </div>

      <div className="app-region-no-drag border-t border-white/10 p-2">
        <button
          type="button"
          onClick={() => newTab()}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#94a3c2] transition-colors hover:bg-white/[0.06] hover:text-[#e7ecf6]"
        >
          <Plus className="size-4" />
          New tab
        </button>
      </div>
    </div>
  );
};

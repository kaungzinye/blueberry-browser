import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  FileDown,
  FileSpreadsheet,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";
import type { BerryKind } from "../domain/gardenDomain";
import type { Agent, Berry } from "../domain/gardenDomain";
import type {
  MainAgentCycleScope,
  MainAgentRosterEntry,
} from "../domain/gardenRoster";
import {
  commandPreview,
  getCommandRosterStatus,
} from "../domain/gardenRoster";

export interface ViewportTransform {
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
}

interface GardenHudProps {
  berries: Berry[];
  viewport: ViewportTransform;
  agent: Agent | undefined;
  latestAgentReply: string | null;
  commandText: string;
  onCommandTextChange: (value: string) => void;
  onSubmit: () => void;
  plannedWorkRunTitle?: string;
  onApprovePlan?: () => void;
  showWorkRunControls?: boolean;
  onAdvanceWorkRun?: () => void;
  onCompleteWorkRun?: () => void;
  mainAgentRoster: MainAgentRosterEntry[];
  selectedMainAgentId: string | null;
  mainAgentCycleScope: MainAgentCycleScope;
  onMainAgentCycleScopeChange: (scope: MainAgentCycleScope) => void;
  onSelectMainAgent: (mainAgentId: string) => void;
  onNewCommand: () => void;
  onMarkCommandDone: (commandId: string) => void;
  onReopenCommand: (commandId: string) => void;
  rosterCycleHint: string | null;
  onDismissRosterHint: () => void;
}

const MINIMAP_WIDTH = 128;
const MINIMAP_HEIGHT = 88;
const WORLD_VIEW_RADIUS = 1200;
const LEFT_SIDE_WIDTH = "17.5rem";
/** Width of the dedicated right HUD column (roster + run controls). */
export const GARDEN_RIGHT_HUD_WIDTH = "14.5rem";

const RIGHT_HUD_BASE =
  "app-region-no-drag pointer-events-auto flex max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/92 shadow-[0_8px_40px_rgba(2,8,23,0.45)] backdrop-blur-xl";

const SCOPE_OPTIONS: { id: MainAgentCycleScope; label: string }[] = [
  { id: "in-progress", label: "Active" },
  { id: "completed", label: "Done" },
  { id: "all", label: "All" },
];

const SIDE_PANEL_BASE =
  "app-region-no-drag pointer-events-auto shrink-0 border-t border-white/10 bg-slate-950/90 backdrop-blur-xl";

const MOCK_CHAT_HISTORY: { role: "user" | "agent"; text: string }[] = [
  {
    role: "user",
    text: "Look at Strawberry's product and sales pages. Find 10 companies that might buy Blueberry and put them in Sheets.",
  },
  {
    role: "agent",
    text: "I'll start on Strawberry's site — product positioning first, then the sales prospecting page, so we know who they sell to before hunting buyers.",
  },
  {
    role: "agent",
    text: "Next I'll run open-web searches for teams that look browser-heavy and match that profile. I'll qualify each lead with evidence URLs.",
  },
  {
    role: "agent",
    text: "When you approve the run, I'll write rows to Google Sheets with outreach angles and keep an XLSX backup in the garden.",
  },
  {
    role: "agent",
    text: "Say when to pause before any outbound messages or changes to external systems.",
  },
];

const CommandInput: React.FC<{
  commandText: string;
  onCommandTextChange: (value: string) => void;
  onSubmit: () => void;
}> = ({ commandText, onCommandTextChange, onSubmit }) => {
  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="app-region-no-drag relative w-full shrink-0">
      <input
        value={commandText}
        onChange={(event) => onCommandTextChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/10 py-3 pl-4 pr-12 text-sm text-white outline-none backdrop-blur-md placeholder:text-slate-500 focus:border-blue-300/60"
        placeholder="Command the garden…"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-blue-200"
        title="Send (Enter)"
        aria-label="Send command"
      >
        <CornerDownLeft className="size-4" />
      </button>
    </form>
  );
};

const ChatMessage: React.FC<{
  role: "user" | "agent";
  text: string;
  faded?: boolean;
}> = ({ role, text, faded }) => (
  <div
    className={`max-w-2xl ${role === "user" ? "ml-auto text-right" : "mr-auto text-left"}`}
  >
    <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
      {role === "user" ? "You" : "Blue"}
    </span>
    <p
      className={`text-sm leading-relaxed ${
        faded
          ? "text-slate-500/70"
          : role === "user"
            ? "rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-slate-200"
            : "text-blue-50"
      }`}
    >
      {text}
    </p>
  </div>
);

const Minimap: React.FC<{
  berries: Berry[];
  viewRect: { left: number; top: number; width: number; height: number };
  toMini: (wx: number, wy: number) => { left: number; top: number };
}> = ({ berries, viewRect, toMini }) => (
  <div
    className="relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-blue-950/60"
    style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    aria-label="Garden minimap"
  >
    <div className="absolute inset-0 bg-blue-950/50" />
    <span
      className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200/80"
      style={{ left: MINIMAP_WIDTH / 2, top: MINIMAP_HEIGHT / 2 }}
    />
    {berries.map((berry) => {
      const point = toMini(berry.x + berry.width / 2, berry.y + berry.height / 2);
      return (
        <span
          key={berry.id}
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200 shadow-[0_0_8px_rgba(125,211,252,0.8)]"
          style={{ left: point.left, top: point.top }}
        />
      );
    })}
    <div
      className="pointer-events-none absolute rounded-md border border-blue-200/50 bg-blue-200/10"
      style={{
        left: viewRect.left,
        top: viewRect.top,
        width: viewRect.width,
        height: viewRect.height,
      }}
    />
  </div>
);

const AgentSlot: React.FC<{ agent: Agent | undefined }> = ({ agent }) => (
  <div className="flex h-[88px] w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 bg-white/5 px-2">
    <div className="relative flex size-12 items-center justify-center rounded-full bg-blue-200/15">
      <div className="flex h-9 w-7 flex-col items-center">
        <div className="h-4 w-4 rounded-full bg-blue-100" />
        <div className="mt-0.5 h-4 w-6 rounded-b-xl rounded-t-md bg-blue-300" />
      </div>
      {agent && agent.state !== "idle" && (
        <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-emerald-400" />
      )}
    </div>
    <span className="text-center text-[10px] uppercase tracking-wider text-slate-500">
      Agent
    </span>
  </div>
);

const HudLeft: React.FC<{
  berries: Berry[];
  agent: Agent | undefined;
  viewRect: { left: number; top: number; width: number; height: number };
  toMini: (wx: number, wy: number) => { left: number; top: number };
}> = ({ berries, agent, viewRect, toMini }) => (
  <div
    className="app-region-no-drag pointer-events-auto flex shrink-0 flex-row items-center gap-2 border-r border-white/10 bg-slate-950/90 px-3 py-3 backdrop-blur-xl"
    style={{ width: LEFT_SIDE_WIDTH }}
  >
    <Minimap berries={berries} viewRect={viewRect} toMini={toMini} />
    <AgentSlot agent={agent} />
  </div>
);

const MainAgentRosterPanel: React.FC<{
  roster: MainAgentRosterEntry[];
  selectedMainAgentId: string | null;
  scope: MainAgentCycleScope;
  onScopeChange: (scope: MainAgentCycleScope) => void;
  onSelectMainAgent: (mainAgentId: string) => void;
  onNewCommand: () => void;
  onMarkCommandDone: (commandId: string) => void;
  onReopenCommand: (commandId: string) => void;
  rosterCycleHint: string | null;
  onDismissRosterHint: () => void;
  berryCount: number;
  plannedWorkRunTitle?: string;
  onApprovePlan?: () => void;
  showWorkRunControls?: boolean;
  onAdvanceWorkRun?: () => void;
  onCompleteWorkRun?: () => void;
}> = ({
  roster,
  selectedMainAgentId,
  scope,
  onScopeChange,
  onSelectMainAgent,
  onNewCommand,
  onMarkCommandDone,
  onReopenCommand,
  rosterCycleHint,
  onDismissRosterHint,
  berryCount,
  plannedWorkRunTitle,
  onApprovePlan,
  showWorkRunControls,
  onAdvanceWorkRun,
  onCompleteWorkRun,
}) => (
  <div className={`${RIGHT_HUD_BASE} flex min-h-0 flex-col`} aria-label="Main Agent roster">
    <div className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          Main Agents
        </p>
        <button
          type="button"
          onClick={onNewCommand}
          className="flex items-center gap-1 rounded-lg border border-blue-200/25 bg-blue-200/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-100 hover:bg-blue-200/20"
          title="New Command"
        >
          <Plus className="size-3" />
          New
        </button>
      </div>
      <div className="flex gap-1" role="group" aria-label="Cycle scope">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onScopeChange(option.id)}
            className={`flex-1 rounded-lg px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${
              scope === option.id
                ? "bg-blue-200/20 text-blue-100"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {rosterCycleHint && (
        <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-1.5 text-[11px] leading-snug text-amber-100/90">
          {rosterCycleHint}
          <button
            type="button"
            className="ml-2 underline opacity-80"
            onClick={onDismissRosterHint}
          >
            OK
          </button>
        </p>
      )}
    </div>

    <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-3">
      {roster.length === 0 ? (
        <li className="px-2 py-6 text-center text-xs text-slate-500">
          No Main Agents in this view.
          <br />
          <button
            type="button"
            className="mt-2 text-blue-200 underline"
            onClick={onNewCommand}
          >
            New Command
          </button>
        </li>
      ) : (
        roster.map((entry, index) => {
          const selected = entry.agent.id === selectedMainAgentId;
          const rosterStatus = getCommandRosterStatus(entry.command);
          return (
            <li key={entry.agent.id}>
              <button
                type="button"
                onClick={() => onSelectMainAgent(entry.agent.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? "border-blue-200/60 bg-blue-200/15 shadow-[0_0_20px_rgba(96,165,250,0.15)]"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-blue-100/80">
                    Main Agent {index + 1}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
                      rosterStatus === "completed"
                        ? "bg-slate-700/80 text-slate-400"
                        : "bg-emerald-400/15 text-emerald-200"
                    }`}
                  >
                    {rosterStatus === "completed" ? "Done" : "Active"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-200">
                  {commandPreview(entry.command)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {entry.agent.currentLabel}
                </p>
              </button>
              {selected && (
                <div className="mt-1 flex gap-1 px-1">
                  {rosterStatus === "in-progress" ? (
                    <button
                      type="button"
                      onClick={() => onMarkCommandDone(entry.command.id)}
                      className="flex-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:bg-white/5"
                    >
                      Mark done
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReopenCommand(entry.command.id)}
                      className="flex-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:bg-white/5"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })
      )}
    </ol>

    <div className="shrink-0 space-y-2 border-t border-white/10 px-3 py-3">
      {plannedWorkRunTitle && onApprovePlan && (
        <div className="space-y-2">
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
            {plannedWorkRunTitle}
          </p>
          <button
            type="button"
            onClick={onApprovePlan}
            className="w-full rounded-xl bg-blue-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-blue-200"
          >
            Approve run
          </button>
        </div>
      )}
      {showWorkRunControls && (
        <div className="flex flex-col gap-2 text-xs">
          {onAdvanceWorkRun && (
            <button
              type="button"
              onClick={onAdvanceWorkRun}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-slate-200 hover:bg-white/15"
            >
              Advance
            </button>
          )}
          {onCompleteWorkRun && (
            <button
              type="button"
              onClick={onCompleteWorkRun}
              className="rounded-xl border border-emerald-300/20 bg-emerald-300/15 px-3 py-2 text-emerald-100"
            >
              Complete run
            </button>
          )}
        </div>
      )}
      <p className="text-center text-[10px] text-slate-600">
        {berryCount} {berryCount === 1 ? "berry" : "berries"} · Tab cycles
      </p>
    </div>
  </div>
);

const BOTTOM_ARTIFACT_ICON: Record<
  "sheet" | "xlsx" | "report" | "lead" | "work-run",
  React.ComponentType<{ className?: string }>
> = {
  sheet: FileSpreadsheet,
  xlsx: FileDown,
  report: FileText,
  lead: Sparkles,
  "work-run": Archive,
};

const MOCK_BOTTOM_ARTIFACTS: {
  id: string;
  kind: BerryKind;
  title: string;
}[] = [
  { id: "mock-sheet", kind: "sheet", title: "Sales leads" },
  { id: "mock-xlsx", kind: "xlsx", title: "leads.xlsx" },
  { id: "mock-report", kind: "report", title: "brief.md" },
  { id: "mock-lead", kind: "lead", title: "Acme Corp" },
];

const HudBottomRight: React.FC = () => (
  <div
    className="app-region-no-drag pointer-events-auto flex h-[88px] shrink-0 items-center gap-2 border-l border-white/10 bg-slate-950/90 px-2 py-2 backdrop-blur-xl"
    style={{ width: LEFT_SIDE_WIDTH }}
    aria-label="Recent artifacts (mock)"
  >
    <p className="w-9 shrink-0 text-center text-[9px] font-medium uppercase leading-tight tracking-wide text-slate-500">
      Your berries
    </p>
    <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
      {MOCK_BOTTOM_ARTIFACTS.map((berry) => {
        const Icon = BOTTOM_ARTIFACT_ICON[berry.kind as keyof typeof BOTTOM_ARTIFACT_ICON];
        if (!Icon) return null;
        return (
          <button
            key={berry.id}
            type="button"
            className="flex w-[4.25rem] shrink-0 flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-1 py-1.5 hover:border-blue-200/30 hover:bg-white/10"
            title={`${berry.title} (${berry.kind})`}
          >
            <Icon className="size-3.5 text-blue-100/80" />
            <span className="w-full truncate text-center text-[9px] text-slate-300">
              {berry.title}
            </span>
            <span className="text-[8px] uppercase tracking-wide text-slate-600">
              {berry.kind}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

/** Chat-only column: no background; garden shows through. */
const HudChatColumn: React.FC<{
  latestAgentReply: string | null;
  commandText: string;
  onCommandTextChange: (value: string) => void;
  onSubmit: () => void;
  expandButton: React.ReactNode;
}> = ({
  latestAgentReply,
  commandText,
  onCommandTextChange,
  onSubmit,
  expandButton,
}) => (
  <div className="pointer-events-none flex w-full max-w-2xl flex-col justify-end gap-2 px-4 pb-3 pt-2">
    <div className="pointer-events-auto flex justify-center">{expandButton}</div>
    {latestAgentReply && (
      <div className="pointer-events-auto relative max-h-[5.5rem] px-1 text-center">
        <p className="line-clamp-4 text-sm leading-relaxed text-blue-50/80">
          {latestAgentReply}
        </p>
      </div>
    )}
    <div className="pointer-events-auto mx-auto w-full max-w-xl">
      <CommandInput
        commandText={commandText}
        onCommandTextChange={onCommandTextChange}
        onSubmit={onSubmit}
      />
    </div>
  </div>
);

export const GardenHud: React.FC<GardenHudProps> = (props) => {
  const {
    berries,
    viewport,
    agent,
    latestAgentReply,
    commandText,
    onCommandTextChange,
    onSubmit,
    plannedWorkRunTitle,
    onApprovePlan,
    showWorkRunControls,
    onAdvanceWorkRun,
    onCompleteWorkRun,
    mainAgentRoster,
    selectedMainAgentId,
    mainAgentCycleScope,
    onMainAgentCycleScopeChange,
    onSelectMainAgent,
    onNewCommand,
    onMarkCommandDone,
    onReopenCommand,
    rosterCycleHint,
    onDismissRosterHint,
  } = props;

  const [chatExpanded, setChatExpanded] = useState(false);

  useEffect(() => {
    if (!chatExpanded) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setChatExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatExpanded]);

  const minimap = useMemo(() => {
    const { panX, panY, zoom, width, height } = viewport;
    const scale = Math.min(
      MINIMAP_WIDTH / (WORLD_VIEW_RADIUS * 2),
      MINIMAP_HEIGHT / (WORLD_VIEW_RADIUS * 2)
    );
    const toMini = (wx: number, wy: number) => ({
      left: MINIMAP_WIDTH / 2 + wx * scale,
      top: MINIMAP_HEIGHT / 2 + wy * scale,
    });

    const viewWorldW = width / zoom;
    const viewWorldH = height / zoom;
    const viewLeft = -panX / zoom;
    const viewTop = -panY / zoom;
    const viewRect = {
      left: MINIMAP_WIDTH / 2 + viewLeft * scale,
      top: MINIMAP_HEIGHT / 2 + viewTop * scale,
      width: Math.max(12, viewWorldW * scale),
      height: Math.max(10, viewWorldH * scale),
    };

    return { toMini, viewRect };
  }, [berries, viewport]);

  const expandButton = (
    <button
      type="button"
      onClick={() => setChatExpanded(true)}
      className="app-region-no-drag pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300 backdrop-blur-md hover:bg-slate-950/90 hover:text-slate-100"
      aria-label="Expand chat"
    >
      <ChevronUp className="size-3.5" />
      Expand chat
    </button>
  );

  const collapseButton = (
    <button
      type="button"
      onClick={() => setChatExpanded(false)}
      onPointerDown={(event) => event.stopPropagation()}
      className="app-region-no-drag flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/90 px-3 py-1.5 text-xs text-slate-200 shadow-lg hover:bg-slate-900"
      aria-label="Collapse chat"
    >
      <ChevronDown className="size-3.5" />
      Collapse
    </button>
  );

  const left = (
    <HudLeft
      berries={berries}
      agent={agent}
      viewRect={minimap.viewRect}
      toMini={minimap.toMini}
    />
  );

  const rightHud = (
    <MainAgentRosterPanel
      roster={mainAgentRoster}
      selectedMainAgentId={selectedMainAgentId}
      scope={mainAgentCycleScope}
      onScopeChange={onMainAgentCycleScopeChange}
      onSelectMainAgent={onSelectMainAgent}
      onNewCommand={onNewCommand}
      onMarkCommandDone={onMarkCommandDone}
      onReopenCommand={onReopenCommand}
      rosterCycleHint={rosterCycleHint}
      onDismissRosterHint={onDismissRosterHint}
      berryCount={berries.length}
      plannedWorkRunTitle={plannedWorkRunTitle}
      onApprovePlan={onApprovePlan}
      showWorkRunControls={showWorkRunControls}
      onAdvanceWorkRun={onAdvanceWorkRun}
      onCompleteWorkRun={onCompleteWorkRun}
    />
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex flex-col"
      aria-label="Garden HUD chrome"
    >
      <div className="relative min-h-0 flex-1" aria-label="Garden view band">
        <div
          className="pointer-events-none absolute right-3 top-1/2 z-40 flex max-h-full -translate-y-1/2 flex-col"
          style={{ width: GARDEN_RIGHT_HUD_WIDTH }}
          aria-label="Garden right HUD"
        >
          {rightHud}
        </div>

        {chatExpanded && (
          <div
            className="pointer-events-none absolute inset-0 z-50 flex flex-col"
            style={{ left: LEFT_SIDE_WIDTH, right: GARDEN_RIGHT_HUD_WIDTH }}
            aria-label="Expanded chat"
          >
            <div className="app-region-no-drag pointer-events-auto flex shrink-0 justify-center py-3">
              {collapseButton}
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-end">
              <div className="app-region-no-drag pointer-events-auto flex max-h-full min-h-0 flex-col rounded-t-3xl border border-white/10 border-b-0 bg-slate-950/92 shadow-[0_-24px_80px_rgba(2,8,23,0.65)] backdrop-blur-xl">
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-8 py-6">
                  {MOCK_CHAT_HISTORY.map((message, index) => (
                    <ChatMessage
                      key={`mock-${index}`}
                      role={message.role}
                      text={message.text}
                      faded={index < MOCK_CHAT_HISTORY.length - 2}
                    />
                  ))}
                  {latestAgentReply && (
                    <ChatMessage role="agent" text={latestAgentReply} />
                  )}
                </div>
                <div className="shrink-0 border-t border-white/10 px-4 py-3">
                  <CommandInput
                    commandText={commandText}
                    onCommandTextChange={onCommandTextChange}
                    onSubmit={onSubmit}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="pointer-events-none grid w-full shrink-0 items-center border-t border-white/10"
        style={{ gridTemplateColumns: `${LEFT_SIDE_WIDTH} 1fr ${LEFT_SIDE_WIDTH}` }}
        aria-label="Garden bottom HUD"
      >
        {left}
        <div className="flex min-h-0 min-w-0 items-end justify-center">
          {!chatExpanded && (
            <HudChatColumn
              latestAgentReply={latestAgentReply}
              commandText={commandText}
              onCommandTextChange={onCommandTextChange}
              onSubmit={onSubmit}
              expandButton={expandButton}
            />
          )}
        </div>
        <HudBottomRight />
      </div>
    </div>
  );
};

export interface FadedGardenEcho {
  id: string;
  role: "user" | "agent";
  text: string;
  x: number;
  y: number;
}

export function fadeMessageOntoGarden(
  messages: FadedGardenEcho[],
  nextIndex: number
): FadedGardenEcho[] {
  const angle = nextIndex * 2.1 - Math.PI / 2;
  const radius = 160 + nextIndex * 55;
  return messages.map((message, index) => {
    const scatterAngle = angle + index * 0.35;
    const scatterRadius = radius + index * 18;
    return {
      ...message,
      x: Math.cos(scatterAngle) * scatterRadius,
      y: Math.sin(scatterAngle) * scatterRadius,
    };
  });
}

export function replyForCommand(
  route: "quick" | "work-run",
  agentLabel?: string
): string {
  if (agentLabel) return agentLabel;
  return route === "quick"
    ? "Quick answer stays here — deeper work will bloom on the garden."
    : "I'll plan visible browser work you can approve before it runs.";
}

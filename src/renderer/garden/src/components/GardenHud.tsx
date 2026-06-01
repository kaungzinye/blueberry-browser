import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bot,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  FileDown,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import type { BerryKind, LedgerEntry } from "../domain/gardenDomain";
import type { Agent, Berry } from "../domain/gardenDomain";
import type {
  MainAgentCycleScope,
  MainAgentRosterEntry,
} from "../domain/gardenRoster";
import {
  commandPreview,
  getCommandRosterStatus,
} from "../domain/gardenRoster";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

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
  /** Artifact Berries produced by the selected Main Agent (Outputs shelf). */
  bottomArtifacts: Berry[];
  bottomArtifactsLabel?: string;
  onSelectArtifact: (berryId: string) => void;
  onOpenLedger: () => void;
  /** All garden-wide artifact berries (non-tab) for the Artifact Roster panel. */
  allArtifacts: LedgerEntry[];
  onShowArtifactOnGarden: (berryId: string) => void;
  onOpenArtifact: (berryId: string) => void;
}

const MINIMAP_WIDTH = 128;
const MINIMAP_HEIGHT = 88;
const WORLD_VIEW_RADIUS = 1200;
const LEFT_SIDE_WIDTH = "17.5rem";
/** Width of the dedicated right HUD column (roster + run controls). */
export const GARDEN_RIGHT_HUD_WIDTH = "15rem";

/** Shared chrome surface — one restrained panel treatment for all HUD slabs. */
const PANEL =
  "app-region-no-drag pointer-events-auto border border-line/10 bg-surface-0/92 backdrop-blur-xl";

const SECTION_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint";

const SCOPE_OPTIONS: { id: MainAgentCycleScope; label: string }[] = [
  { id: "in-progress", label: "Active" },
  { id: "completed", label: "Done" },
  { id: "all", label: "All" },
];

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
        className="w-full rounded-2xl border border-line/12 bg-surface-2/80 py-3 pl-4 pr-12 text-sm text-ink outline-none backdrop-blur-md transition-colors placeholder:text-ink-faint focus:border-accent/60"
        placeholder="Command the garden…"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-accent"
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
    <span className={`mb-1 block ${SECTION_LABEL}`}>
      {role === "user" ? "You" : "Main Agent"}
    </span>
    <p
      className={`text-sm leading-relaxed ${
        faded
          ? "text-ink-faint/70"
          : role === "user"
            ? "rounded-2xl border border-line/10 bg-surface-2/70 px-4 py-2.5 text-ink"
            : "text-accent-strong"
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
    className="relative shrink-0 overflow-hidden rounded-2xl border border-line/10 bg-garden-base"
    style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    aria-label="Garden minimap"
  >
    <div className="garden-field absolute inset-0 opacity-70" />
    <span
      className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/80"
      style={{ left: MINIMAP_WIDTH / 2, top: MINIMAP_HEIGHT / 2 }}
    />
    {berries.map((berry) => {
      const point = toMini(berry.x + berry.width / 2, berry.y + berry.height / 2);
      return (
        <span
          key={berry.id}
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: point.left, top: point.top }}
        />
      );
    })}
    <div
      className="pointer-events-none absolute rounded-md border border-accent/50 bg-accent/10"
      style={{
        left: viewRect.left,
        top: viewRect.top,
        width: viewRect.width,
        height: viewRect.height,
      }}
    />
  </div>
);

/** Compact Main Agent identity tile for the bottom-left HUD (no 3D here). */
const AgentBadge: React.FC<{ agent: Agent | undefined }> = ({ agent }) => {
  const active = Boolean(agent && agent.state !== "idle");
  return (
    <div className="flex h-[88px] w-[4.5rem] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-line/12 bg-surface-1/70 px-2">
      <div className="relative flex size-11 items-center justify-center rounded-full bg-accent/12 text-accent">
        <Bot className="size-5" />
        {active && (
          <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-tm-complete" />
        )}
      </div>
      <span className={SECTION_LABEL}>Agent</span>
    </div>
  );
};

const HudLeft: React.FC<{
  berries: Berry[];
  agent: Agent | undefined;
  viewRect: { left: number; top: number; width: number; height: number };
  toMini: (wx: number, wy: number) => { left: number; top: number };
}> = ({ berries, agent, viewRect, toMini }) => (
  <div
    className={`${PANEL} flex shrink-0 flex-row items-center gap-2 border-l-0 border-b-0 border-r border-t-0 px-3 py-3`}
    style={{ width: LEFT_SIDE_WIDTH }}
  >
    <Minimap berries={berries} viewRect={viewRect} toMini={toMini} />
    <AgentBadge agent={agent} />
  </div>
);

const RosterEntry: React.FC<{
  entry: MainAgentRosterEntry;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onMarkDone: () => void;
  onReopen: () => void;
}> = ({ entry, index, selected, onSelect, onMarkDone, onReopen }) => {
  const rosterStatus = getCommandRosterStatus(entry.command);
  const done = rosterStatus === "completed";
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
          selected
            ? "border-accent/55 bg-accent/10"
            : "border-line/10 bg-white/[0.03] hover:border-line/20 hover:bg-white/[0.06]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent/80">
            Main Agent {index + 1}
          </span>
          <Badge variant={done ? "done" : "active"} size="xs">
            {done ? "Done" : "Active"}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink">
          {commandPreview(entry.command)}
        </p>
        <p className="mt-1 font-mono text-[10px] text-ink-faint">
          {entry.agent.currentLabel}
        </p>
      </button>
      {selected && (
        <div className="mt-1 px-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={done ? onReopen : onMarkDone}
          >
            {done ? "Reopen" : "Mark done"}
          </Button>
        </div>
      )}
    </li>
  );
};

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
  expanded: boolean;
  onToggleExpanded: () => void;
  cycleFlash: boolean;
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
  expanded,
  onToggleExpanded,
  cycleFlash,
}) => {
  if (!expanded) {
    const selectedEntry =
      roster.find((e) => e.agent.id === selectedMainAgentId) ?? roster[0];
    const selectedIndex = selectedEntry ? roster.indexOf(selectedEntry) : 0;
    const done =
      selectedEntry
        ? getCommandRosterStatus(selectedEntry.command) === "completed"
        : false;

    return (
      <button
        type="button"
        onClick={onToggleExpanded}
        className={`${PANEL} w-full rounded-xl px-3 py-2.5 text-left transition-all ${
          cycleFlash ? "ring-1 ring-accent/60" : ""
        }`}
        aria-label="Expand Main Agent roster"
      >
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-accent/80">
            {roster.length === 0 ? "Agents" : `Agent ${selectedIndex + 1}`}
          </span>
          {roster.length > 0 && (
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                done ? "bg-tm-complete" : "animate-pulse bg-accent"
              }`}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-ink">
            {selectedEntry?.agent.currentLabel ?? "No agents · Tab cycles"}
          </span>
          {roster.length > 1 && (
            <span className="shrink-0 rounded-full bg-surface-2/60 px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
              {roster.length}
            </span>
          )}
          <ChevronDown className="size-3 shrink-0 text-ink-faint" />
        </div>
      </button>
    );
  }

  return (
    <div
      className={`${PANEL} flex max-h-full min-h-0 w-full flex-col rounded-2xl shadow-panel`}
      aria-label="Main Agent roster"
    >
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-line/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className={SECTION_LABEL}>Main Agents</p>
          <div className="flex items-center gap-1">
            <Button variant="subtle" size="sm" onClick={onNewCommand} title="New Command">
              <Plus className="size-3" />
              New
            </Button>
            <button
              type="button"
              onClick={onToggleExpanded}
              className="rounded-lg p-1 text-ink-faint transition-colors hover:text-ink"
              aria-label="Collapse roster"
            >
              <ChevronUp className="size-3.5" />
            </button>
          </div>
        </div>
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(value) => value && onScopeChange(value as MainAgentCycleScope)}
          aria-label="Cycle scope"
        >
          {SCOPE_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.id} value={option.id}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {rosterCycleHint && (
          <p className="rounded-lg border border-tm-blocker/25 bg-tm-blocker/10 px-2 py-1.5 text-[11px] leading-snug text-tm-blocker">
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

      <ScrollArea className="min-h-0 flex-1">
        <ol className="flex flex-col gap-2 px-2 py-3">
          {roster.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-ink-faint">
              No Main Agents in this view.
              <br />
              <button
                type="button"
                className="mt-2 text-accent underline"
                onClick={onNewCommand}
              >
                New Command
              </button>
            </li>
          ) : (
            roster.map((entry, index) => (
              <RosterEntry
                key={entry.agent.id}
                entry={entry}
                index={index}
                selected={entry.agent.id === selectedMainAgentId}
                onSelect={() => onSelectMainAgent(entry.agent.id)}
                onMarkDone={() => onMarkCommandDone(entry.command.id)}
                onReopen={() => onReopenCommand(entry.command.id)}
              />
            ))
          )}
        </ol>
      </ScrollArea>

      <div className="shrink-0 space-y-2 border-t border-line/10 px-3 py-3">
        {plannedWorkRunTitle && onApprovePlan && (
          <div className="space-y-2">
            <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
              {plannedWorkRunTitle}
            </p>
            <Button variant="primary" size="md" className="w-full" onClick={onApprovePlan}>
              Approve run
            </Button>
          </div>
        )}
        {showWorkRunControls && (
          <div className="flex flex-col gap-2">
            {onAdvanceWorkRun && (
              <Button variant="outline" size="md" className="w-full" onClick={onAdvanceWorkRun}>
                Advance
              </Button>
            )}
            {onCompleteWorkRun && (
              <Button variant="success" size="md" className="w-full" onClick={onCompleteWorkRun}>
                Complete run
              </Button>
            )}
          </div>
        )}
        <p className="text-center font-mono text-[10px] text-ink-faint">
          {berryCount} {berryCount === 1 ? "berry" : "berries"} · Tab cycles
        </p>
      </div>
    </div>
  );
};

const ARTIFACT_ICONS: Partial<
  Record<BerryKind, React.ComponentType<{ className?: string }>>
> = {
  sheet: FileSpreadsheet,
  xlsx: FileDown,
  report: FileText,
  lead: Sparkles,
  "work-run": Archive,
};

// Keep original alias for HudBottomRight which uses a different name
const ARTIFACT_ICON = ARTIFACT_ICONS;

const artifactIconFor = (
  kind: BerryKind
): React.ComponentType<{ className?: string }> => ARTIFACT_ICON[kind] ?? FileText;

type ArtifactKindFilter = BerryKind | "all";

const ARTIFACT_KIND_FILTERS: { id: ArtifactKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sheet", label: "Sheet" },
  { id: "report", label: "Report" },
  { id: "lead", label: "Lead" },
  { id: "xlsx", label: "XLSX" },
  { id: "work-run", label: "Run" },
];

const ArtifactRosterPanel: React.FC<{
  artifacts: LedgerEntry[];
  onShowOnGarden: (berryId: string) => void;
  onOpen: (berryId: string) => void;
  headerActions?: React.ReactNode;
}> = ({ artifacts, onShowOnGarden, onOpen, headerActions }) => {
  const [kindFilter, setKindFilter] = useState<ArtifactKindFilter>("all");

  const visibleKinds = useMemo(
    () => new Set(artifacts.map((a) => a.kind)),
    [artifacts]
  );

  const filtered = useMemo(
    () =>
      kindFilter === "all" ? artifacts : artifacts.filter((a) => a.kind === kindFilter),
    [artifacts, kindFilter]
  );

  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, LedgerEntry[]>>((acc, entry) => {
        (acc[entry.workRunTitle] ??= []).push(entry);
        return acc;
      }, {}),
    [filtered]
  );

  return (
    <div
      className={`${PANEL} flex max-h-full min-h-0 w-full flex-col rounded-2xl shadow-panel`}
      aria-label="Artifact roster"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-line/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className={SECTION_LABEL}>Artifacts</p>
          {headerActions}
        </div>
        <div className="flex flex-wrap gap-1">
          {ARTIFACT_KIND_FILTERS.filter(
            (f) => f.id === "all" || visibleKinds.has(f.id as BerryKind)
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setKindFilter(f.id)}
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                kindFilter === f.id
                  ? "bg-accent/15 text-accent"
                  : "text-ink-faint hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {artifacts.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-ink-faint">
            No artifacts yet.
            <br />
            Approve a Work Run to produce them.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-ink-faint">
            No {kindFilter}s in this Garden.
          </p>
        ) : (
          <div className="flex flex-col gap-4 px-2 py-3">
            {Object.entries(grouped).map(([runTitle, entries]) => (
              <div key={runTitle}>
                <p className="mb-1.5 px-1 font-mono text-[10px] uppercase tracking-wider text-accent/70 truncate">
                  {runTitle}
                </p>
                <ol className="flex flex-col gap-1.5">
                  {entries.map((entry) => {
                    const Icon = artifactIconFor(entry.kind);
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(entry.id)}
                          className="w-full rounded-xl border border-line/10 bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:border-line/20 hover:bg-white/[0.06]"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 shrink-0 rounded-lg bg-accent/12 p-1.5 text-accent">
                              <Icon className="size-3" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-ink">
                                {entry.title}
                              </p>
                              <p className="truncate font-mono text-[10px] text-ink-faint">
                                {entry.subtitle}
                              </p>
                            </div>
                            {!entry.onMap && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onShowOnGarden(entry.id);
                                }}
                                className="shrink-0 rounded-lg border border-line/10 bg-white/[0.03] px-1.5 py-1 font-mono text-[9px] uppercase tracking-wide text-ink-faint transition-colors hover:border-accent/40 hover:text-accent"
                                title="Pin to garden canvas"
                              >
                                Pin
                              </button>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="shrink-0 border-t border-line/10 px-3 py-2.5">
        <p className="text-center font-mono text-[10px] text-ink-faint">
          {artifacts.length} {artifacts.length === 1 ? "artifact" : "artifacts"} · ⌘I full view
        </p>
      </div>
    </div>
  );
};

const ArtifactsShelf: React.FC<{
  artifacts: Berry[];
  agentLabel?: string;
  onSelectArtifact: (berryId: string) => void;
  onOpenLedger: () => void;
  panelExpanded: boolean;
  onTogglePanel: () => void;
}> = ({ artifacts, agentLabel, onSelectArtifact, onOpenLedger, panelExpanded, onTogglePanel }) => {
  const lastArtifact = artifacts[artifacts.length - 1];
  const extra = artifacts.length - 1;

  return (
    <div
      className={`${PANEL} flex h-[88px] shrink-0 flex-col justify-center gap-1.5 border-b-0 border-l border-r-0 border-t-0 px-3 py-2`}
      style={{ width: LEFT_SIDE_WIDTH }}
      aria-label="Artifacts shelf"
    >
      <div className="flex items-center gap-2">
        <span className={`${SECTION_LABEL} flex items-center gap-1.5`}>
          Artifacts
          {artifacts.length > 0 && (
            <span className="rounded-full bg-accent/20 px-1 py-0.5 text-[9px] text-accent">
              {artifacts.length}
            </span>
          )}
        </span>
        {agentLabel && (
          <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-ink-faint">
            {agentLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onTogglePanel}
          className="ml-auto shrink-0 rounded-lg border border-line/10 bg-white/[0.03] p-1 text-ink-faint transition-colors hover:border-accent/40 hover:text-accent"
          aria-label={panelExpanded ? "Collapse artifacts" : "Expand artifacts"}
        >
          {panelExpanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </button>
      </div>

      {artifacts.length === 0 ? (
        <p className="text-[11px] leading-tight text-ink-faint">No outputs yet</p>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          {lastArtifact && (() => {
            const Icon = artifactIconFor(lastArtifact.kind);
            return (
              <button
                type="button"
                onClick={() => onSelectArtifact(lastArtifact.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line/10 bg-white/[0.03] px-2 py-1.5 text-left transition-colors hover:border-accent/40 hover:bg-white/[0.07]"
                title={`${lastArtifact.title} · ${lastArtifact.kind}`}
              >
                <Icon className="size-3.5 shrink-0 text-accent" />
                <span className="truncate text-[11px] text-ink">{lastArtifact.title}</span>
              </button>
            );
          })()}
          {extra > 0 && (
            <button
              type="button"
              onClick={onOpenLedger}
              className="shrink-0 rounded-lg border border-line/10 bg-white/[0.03] px-2 py-1.5 font-mono text-[10px] text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
              title="Open Intel Ledger"
            >
              +{extra}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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
        <p className="line-clamp-4 text-sm leading-relaxed text-accent-strong/85">
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
    bottomArtifacts,
    bottomArtifactsLabel,
    onSelectArtifact,
    onOpenLedger,
    allArtifacts,
    onShowArtifactOnGarden,
    onOpenArtifact,
  } = props;

  const [chatExpanded, setChatExpanded] = useState(false);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);
  const [cycleFlash, setCycleFlash] = useState(false);
  const [artifactsPanelExpanded, setArtifactsPanelExpanded] = useState(false);
  const [artifactsFullscreen, setArtifactsFullscreen] = useState(false);

  useEffect(() => {
    if (!chatExpanded) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setChatExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatExpanded]);

  useEffect(() => {
    if (!artifactsFullscreen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setArtifactsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [artifactsFullscreen]);

  useEffect(() => {
    if (!selectedMainAgentId) return;
    setCycleFlash(true);
    const t = setTimeout(() => setCycleFlash(false), 500);
    return () => clearTimeout(t);
  }, [selectedMainAgentId]);

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
  }, [viewport]);

  const expandButton = (
    <button
      type="button"
      onClick={() => setChatExpanded(true)}
      className="app-region-no-drag pointer-events-auto flex items-center gap-1.5 rounded-full border border-line/10 bg-surface-0/70 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted backdrop-blur-md transition-colors hover:bg-surface-0/90 hover:text-ink"
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
      className="app-region-no-drag flex shrink-0 items-center gap-1.5 rounded-full border border-line/10 bg-surface-0/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-ink shadow-lift transition-colors hover:bg-surface-1"
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

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex flex-col"
      aria-label="Garden HUD chrome"
    >
      {/* Artifacts fullscreen overlay — covers entire HUD, ESC closes */}
      {artifactsFullscreen && (
        <div className="pointer-events-auto absolute inset-4 z-50 flex flex-col overflow-hidden rounded-2xl shadow-panel">
          <ArtifactRosterPanel
            artifacts={allArtifacts}
            onShowOnGarden={onShowArtifactOnGarden}
            onOpen={onOpenArtifact}
            headerActions={
              <button
                type="button"
                onClick={() => setArtifactsFullscreen(false)}
                className="rounded-lg border border-line/10 bg-white/[0.03] p-1 text-ink-faint transition-colors hover:border-accent/40 hover:text-ink"
                aria-label="Exit full screen"
              >
                <X className="size-3.5" />
              </button>
            }
          />
        </div>
      )}

      <div className="relative min-h-0 flex-1" aria-label="Garden view band">
        {/* Agents right column — compact chip or expanded roster */}
        <div
          className="pointer-events-none absolute right-3 top-1/2 z-40 flex max-h-full -translate-y-1/2 flex-col"
          style={{ width: GARDEN_RIGHT_HUD_WIDTH }}
          aria-label="Garden right HUD"
        >
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
            expanded={rightPanelExpanded}
            onToggleExpanded={() => setRightPanelExpanded((v) => !v)}
            cycleFlash={cycleFlash}
          />
        </div>

        {/* Artifacts panel overlay — floats above bottom bar from bottom-right */}
        {artifactsPanelExpanded && !artifactsFullscreen && (
          <div
            className="pointer-events-none absolute bottom-2 right-3 z-40"
            style={{ width: LEFT_SIDE_WIDTH }}
          >
            <ArtifactRosterPanel
              artifacts={allArtifacts}
              onShowOnGarden={onShowArtifactOnGarden}
              onOpen={onOpenArtifact}
              headerActions={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setArtifactsFullscreen(true)}
                    className="rounded-lg border border-line/10 bg-white/[0.03] p-1 text-ink-faint transition-colors hover:border-accent/40 hover:text-accent"
                    aria-label="Full screen artifacts"
                  >
                    <Maximize2 className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setArtifactsPanelExpanded(false)}
                    className="rounded-lg border border-line/10 bg-white/[0.03] p-1 text-ink-faint transition-colors hover:border-accent/40 hover:text-ink"
                    aria-label="Collapse artifacts panel"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              }
            />
          </div>
        )}

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
              <div
                className={`${PANEL} flex max-h-full min-h-0 flex-col rounded-b-none rounded-t-3xl border-b-0 shadow-sheet`}
              >
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-6 px-8 py-6">
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
                </ScrollArea>
                <div className="shrink-0 border-t border-line/10 px-4 py-3">
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
        className="pointer-events-none grid w-full shrink-0 items-center border-t border-line/10"
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
        <ArtifactsShelf
          artifacts={bottomArtifacts}
          agentLabel={bottomArtifactsLabel}
          onSelectArtifact={onSelectArtifact}
          onOpenLedger={onOpenLedger}
          panelExpanded={artifactsPanelExpanded}
          onTogglePanel={() => setArtifactsPanelExpanded((v) => !v)}
        />
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

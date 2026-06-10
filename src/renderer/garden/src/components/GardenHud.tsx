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
import {
  filterBerrySwitcher,
  type BerryKind,
  type CommandLogEntry,
  type LedgerEntry,
  type SourceBerryChoice,
} from "../domain/gardenDomain";
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
  /** Selected command is ambiguous — ask quick vs visible (PRD story 14). */
  awaitingRoute?: boolean;
  onChooseRoute?: (route: "quick" | "work-run") => void;
  /** Selected command is a finished quick reply that can become a Work Run. */
  upgradeable?: boolean;
  onUpgradeCommand?: () => void;
  commandText: string;
  onCommandTextChange: (value: string) => void;
  onSubmit: () => void;
  plannedWorkRunTitle?: string;
  onApprovePlan?: () => void;
  showWorkRunControls?: boolean;
  onAdvanceWorkRun?: () => void;
  onCompleteWorkRun?: (sourceChoice: SourceBerryChoice) => void;
  /** Selected Work Run status — drives pause/retry controls (stories 45–47). */
  workRunStatus?: string;
  onPauseWorkRun?: () => void;
  onRetryWorkRun?: () => void;
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
  /** Global, secondary Command Log (PRD stories 16–17). */
  commandLog: CommandLogEntry[];
  /** Every Berry (tabs + artifacts) for the ⌘K Berry switcher (PRD story 9). */
  switcherEntries: LedgerEntry[];
  onActivateBerry: (berryId: string) => void;
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
  onOpenLog: () => void;
}> = ({ berries, agent, viewRect, toMini, onOpenLog }) => (
  <div
    className={`${PANEL} flex shrink-0 flex-row items-center gap-2 border-l-0 border-b-0 border-r border-t-0 px-3 py-3`}
    style={{ width: LEFT_SIDE_WIDTH }}
  >
    <Minimap berries={berries} viewRect={viewRect} toMini={toMini} />
    <AgentBadge agent={agent} />
    <button
      type="button"
      onClick={onOpenLog}
      className="flex h-[88px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-line/12 bg-surface-1/70 px-2 text-ink-faint transition-colors hover:border-accent/40 hover:text-ink"
      title="Open Command Log"
      aria-label="Open Command Log"
    >
      <FileText className="size-4" />
      <span className={SECTION_LABEL}>Log</span>
    </button>
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
  onCompleteWorkRun?: (sourceChoice: SourceBerryChoice) => void;
  workRunStatus?: string;
  onPauseWorkRun?: () => void;
  onRetryWorkRun?: () => void;
  onToggleExpanded: () => void;
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
  workRunStatus,
  onPauseWorkRun,
  onRetryWorkRun,
  onToggleExpanded,
}) => {
  // Stories 60–61: what happens to source Berries when the run completes.
  const [sourceChoice, setSourceChoice] = useState<SourceBerryChoice>("collapse");
  return (
    <div
      className={`${PANEL} hud-rise flex max-h-full min-h-0 w-full flex-col rounded-2xl shadow-panel`}
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
            {onPauseWorkRun && (
              <Button variant="ghost" size="md" className="w-full" onClick={onPauseWorkRun}>
                Pause
              </Button>
            )}
            {onCompleteWorkRun && (
              <>
                <div className="flex items-center justify-center gap-1">
                  <span className="mr-1 font-mono text-[9px] uppercase tracking-wide text-ink-faint">
                    Sources
                  </span>
                  {(["collapse", "keep", "close"] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setSourceChoice(choice)}
                      className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                        sourceChoice === choice
                          ? "bg-accent/15 text-accent"
                          : "text-ink-faint hover:text-ink"
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
                <Button
                  variant="success"
                  size="md"
                  className="w-full"
                  onClick={() => onCompleteWorkRun(sourceChoice)}
                >
                  Complete run
                </Button>
              </>
            )}
          </div>
        )}
        {(workRunStatus === "blocked" || workRunStatus === "interrupted") &&
          onRetryWorkRun && (
            <div className="space-y-1.5">
              <p className="text-center font-mono text-[10px] uppercase tracking-wide text-tm-blocker">
                {workRunStatus === "blocked" ? "Run blocked" : "Run paused"}
              </p>
              <Button variant="primary" size="md" className="w-full" onClick={onRetryWorkRun}>
                {workRunStatus === "blocked" ? "Retry" : "Resume"}
              </Button>
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

/**
 * Berry switcher palette (PRD story 9): ⌘K fast switcher over every Berry —
 * tabs and artifacts alike — with type-to-filter and arrow/Enter navigation.
 */
const BerrySwitcherPalette: React.FC<{
  entries: LedgerEntry[];
  onActivate: (berryId: string) => void;
  onClose: () => void;
}> = ({ entries, onActivate, onClose }) => {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => filterBerrySwitcher(entries, query),
    [entries, query],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const activate = (berryId: string): void => {
    onActivate(berryId);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "Escape") onClose();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    }
    if (event.key === "Enter" && filtered[cursor]) {
      event.preventDefault();
      activate(filtered[cursor].id);
    }
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[60] flex items-start justify-center bg-garden-base/40 pt-[12vh] hud-fade"
      onMouseDown={onClose}
      aria-label="Berry switcher"
    >
      <div
        className={`${PANEL} hud-drop flex max-h-[60vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-panel`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Switch to a Berry…"
          className="w-full border-b border-line/10 bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <ScrollArea className="min-h-0 flex-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-ink-faint">
              No Berries match “{query}”.
            </p>
          ) : (
            <ol className="flex flex-col px-2 py-2">
              {filtered.map((entry, index) => {
                const Icon = artifactIconFor(entry.kind);
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => activate(entry.id)}
                      onMouseEnter={() => setCursor(index)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                        index === cursor
                          ? "bg-accent/12 text-ink"
                          : "text-ink-muted hover:bg-white/[0.04]"
                      }`}
                    >
                      <Icon className="size-3.5 shrink-0 text-accent" />
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {entry.title}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-ink-faint">
                        {entry.kind}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </ScrollArea>
        <p className="shrink-0 border-t border-line/10 px-4 py-2 text-center font-mono text-[10px] text-ink-faint">
          ↑↓ navigate · ↵ open · esc close
        </p>
      </div>
    </div>
  );
};

/**
 * Hidden-by-default agent rail. Hovering the right window edge fades in the
 * full vertical rail; Tab-cycling transiently surfaces the 3 most recently
 * selected agents. Clicking a tile selects; the bottom tile opens the roster.
 */
const AgentRail: React.FC<{
  entries: MainAgentRosterEntry[];
  selectedMainAgentId: string | null;
  onSelect: (mainAgentId: string) => void;
  onExpand: () => void;
  indexOf: (mainAgentId: string) => number;
}> = ({ entries, selectedMainAgentId, onSelect, onExpand, indexOf }) => (
  <div
    className={`${PANEL} hud-fade flex flex-col items-center gap-2 rounded-2xl p-2 shadow-panel`}
    aria-label="Agent rail"
  >
    {entries.map((entry) => {
      const selected = entry.agent.id === selectedMainAgentId;
      const done = getCommandRosterStatus(entry.command) === "completed";
      return (
        <button
          key={entry.agent.id}
          type="button"
          onClick={() => onSelect(entry.agent.id)}
          className={`relative flex size-10 items-center justify-center rounded-full border transition-all duration-200 ${
            selected
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-line/12 bg-surface-1/70 text-ink-muted hover:border-accent/40 hover:text-ink"
          }`}
          title={`Main Agent ${indexOf(entry.agent.id) + 1} — ${entry.agent.currentLabel}`}
          aria-label={`Select Main Agent ${indexOf(entry.agent.id) + 1}`}
        >
          <Bot className="size-4" />
          <span
            className={`absolute -right-0.5 -top-0.5 size-2 rounded-full ${
              done ? "bg-tm-complete" : "animate-pulse bg-accent"
            }`}
          />
          <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-surface-2 font-mono text-[8px] text-ink-muted">
            {indexOf(entry.agent.id) + 1}
          </span>
        </button>
      );
    })}
    <button
      type="button"
      onClick={onExpand}
      className="flex size-10 items-center justify-center rounded-full border border-line/12 bg-surface-1/70 text-ink-faint transition-colors hover:border-accent/40 hover:text-ink"
      title="Open agent roster"
      aria-label="Open agent roster"
    >
      <Maximize2 className="size-3.5" />
    </button>
  </div>
);

/**
 * Command Log overlay (PRD stories 16–17): all commands with their exact
 * tool/action traces. Deliberately secondary — opened on demand, never the
 * primary surface.
 */
const CommandLogPanel: React.FC<{
  log: CommandLogEntry[];
  onClose: () => void;
}> = ({ log, onClose }) => (
  <div
    className={`${PANEL} hud-rise pointer-events-auto absolute inset-4 z-50 flex flex-col overflow-hidden rounded-2xl shadow-panel`}
    aria-label="Command Log"
  >
    <div className="flex shrink-0 items-center justify-between border-b border-line/10 px-4 py-3">
      <p className={SECTION_LABEL}>Command Log</p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-line/10 bg-white/[0.03] p-1 text-ink-faint transition-colors hover:border-accent/40 hover:text-ink"
        aria-label="Close Command Log"
      >
        <X className="size-3.5" />
      </button>
    </div>
    <ScrollArea className="min-h-0 flex-1">
      {log.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-ink-faint">
          No commands yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-3 px-4 py-4">
          {log.map((entry) => (
            <li
              key={entry.commandId}
              className="rounded-xl border border-line/10 bg-white/[0.03] px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant={entry.status === "complete" ? "done" : "active"}
                  size="xs"
                >
                  {entry.route}
                </Badge>
                {entry.workRunTitle && (
                  <span className="truncate font-mono text-[10px] text-accent/70">
                    {entry.workRunTitle}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink">
                {entry.text || "(empty command)"}
              </p>
              {entry.response && (
                <p className="mt-1 text-xs leading-relaxed text-accent-strong/85">
                  {entry.response}
                </p>
              )}
              {entry.trace.length > 0 && (
                <ol className="mt-2 flex flex-col gap-1 border-t border-line/10 pt-2">
                  {entry.trace.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-baseline gap-2 font-mono text-[10px]"
                    >
                      <span className="shrink-0 uppercase tracking-wide text-ink-faint">
                        {event.kind}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-muted">
                        {event.label}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </ScrollArea>
  </div>
);

/**
 * Routing affordances row — "answer quickly or run visibly?" for ambiguous
 * commands, and "run visibly instead" to upgrade a finished quick reply.
 */
const RouteChoiceRow: React.FC<{
  awaitingRoute?: boolean;
  onChooseRoute?: (route: "quick" | "work-run") => void;
  upgradeable?: boolean;
  onUpgradeCommand?: () => void;
}> = ({ awaitingRoute, onChooseRoute, upgradeable, onUpgradeCommand }) => {
  if (awaitingRoute && onChooseRoute) {
    return (
      <div className="pointer-events-auto hud-rise flex items-center justify-center gap-2">
        <span className={SECTION_LABEL}>Quick answer or visible run?</span>
        <Button variant="subtle" size="sm" onClick={() => onChooseRoute("quick")}>
          Answer quickly
        </Button>
        <Button variant="primary" size="sm" onClick={() => onChooseRoute("work-run")}>
          Run visibly
        </Button>
      </div>
    );
  }
  if (upgradeable && onUpgradeCommand) {
    return (
      <div className="pointer-events-auto hud-fade flex justify-center">
        <Button variant="subtle" size="sm" onClick={onUpgradeCommand}>
          <Sparkles className="size-3" />
          Run visibly instead
        </Button>
      </div>
    );
  }
  return null;
};

/** Chat-only column: no background; garden shows through. */
const HudChatColumn: React.FC<{
  latestAgentReply: string | null;
  commandText: string;
  onCommandTextChange: (value: string) => void;
  onSubmit: () => void;
  expandButton: React.ReactNode;
  routeChoice: React.ReactNode;
}> = ({
  latestAgentReply,
  commandText,
  onCommandTextChange,
  onSubmit,
  expandButton,
  routeChoice,
}) => (
  // Same max-w-3xl column as the expanded chat sheet, so the input keeps one
  // width and one axis across collapsed/expanded states — no resize jump.
  <div className="pointer-events-none flex w-full max-w-3xl flex-col justify-end gap-2 px-4 pb-3 pt-2 hud-rise">
    <div className="pointer-events-auto flex justify-center">{expandButton}</div>
    {routeChoice}
    {latestAgentReply && (
      <div className="pointer-events-auto relative max-h-[5.5rem] px-1 text-center hud-fade">
        <p className="line-clamp-4 text-sm leading-relaxed text-accent-strong/85">
          {latestAgentReply}
        </p>
      </div>
    )}
    <div className="pointer-events-auto w-full">
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
    awaitingRoute,
    onChooseRoute,
    upgradeable,
    onUpgradeCommand,
    commandText,
    onCommandTextChange,
    onSubmit,
    plannedWorkRunTitle,
    onApprovePlan,
    showWorkRunControls,
    onAdvanceWorkRun,
    onCompleteWorkRun,
    workRunStatus,
    onPauseWorkRun,
    onRetryWorkRun,
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
    commandLog,
    switcherEntries,
    onActivateBerry,
  } = props;

  const [chatExpanded, setChatExpanded] = useState(false);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  /** Right-edge hover reveals the full agent rail. */
  const [railHovered, setRailHovered] = useState(false);
  /** Tab-cycling transiently surfaces the recent-agents rail. */
  const [cycleRailVisible, setCycleRailVisible] = useState(false);
  /** Most recently selected Main Agent ids, newest first. */
  const [recentAgentIds, setRecentAgentIds] = useState<string[]>([]);
  const [artifactsPanelExpanded, setArtifactsPanelExpanded] = useState(false);
  const [artifactsFullscreen, setArtifactsFullscreen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (!logOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setLogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [logOpen]);

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

  // Track selection recency and transiently surface the recent-agents rail.
  useEffect(() => {
    if (!selectedMainAgentId) return;
    setRecentAgentIds((ids) =>
      [selectedMainAgentId, ...ids.filter((id) => id !== selectedMainAgentId)].slice(0, 3),
    );
    setCycleRailVisible(true);
    const t = setTimeout(() => setCycleRailVisible(false), 1500);
    return () => clearTimeout(t);
  }, [selectedMainAgentId]);

  // ⌘K — Berry switcher palette.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSwitcherOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      onOpenLog={() => setLogOpen(true)}
    />
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex flex-col"
      aria-label="Garden HUD chrome"
    >
      {/* Command Log overlay — secondary, ESC closes */}
      {logOpen && (
        <CommandLogPanel log={commandLog} onClose={() => setLogOpen(false)} />
      )}

      {/* Artifacts fullscreen overlay — covers entire HUD, ESC closes */}
      {artifactsFullscreen && (
        <div className="pointer-events-auto absolute inset-4 z-50 flex flex-col overflow-hidden rounded-2xl shadow-panel hud-rise">
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

      {/* ⌘K Berry switcher palette */}
      {switcherOpen && (
        <BerrySwitcherPalette
          entries={switcherEntries}
          onActivate={onActivateBerry}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      <div className="relative min-h-0 flex-1" aria-label="Garden view band">
        {/* Agents right column — hidden rail (hover / cycle) or expanded roster */}
        {rightPanelExpanded ? (
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
              workRunStatus={workRunStatus}
              onPauseWorkRun={onPauseWorkRun}
              onRetryWorkRun={onRetryWorkRun}
              onToggleExpanded={() => setRightPanelExpanded(false)}
            />
          </div>
        ) : (
          <>
            {/* Invisible right-edge hover zone — reveals the full agent rail */}
            <div
              className="pointer-events-auto absolute bottom-0 right-0 top-0 z-40 w-3"
              onMouseEnter={() => setRailHovered(true)}
              aria-hidden
            />
            {(railHovered || cycleRailVisible) && mainAgentRoster.length > 0 && (
              <div
                className="pointer-events-auto absolute right-2 top-1/2 z-40 -translate-y-1/2"
                onMouseEnter={() => setRailHovered(true)}
                onMouseLeave={() => setRailHovered(false)}
              >
                <AgentRail
                  entries={
                    railHovered
                      ? mainAgentRoster
                      : // Cycling: only the most recently selected agents.
                        recentAgentIds
                          .map((id) =>
                            mainAgentRoster.find((e) => e.agent.id === id),
                          )
                          .filter(
                            (e): e is MainAgentRosterEntry => Boolean(e),
                          )
                  }
                  selectedMainAgentId={selectedMainAgentId}
                  onSelect={onSelectMainAgent}
                  onExpand={() => setRightPanelExpanded(true)}
                  indexOf={(id) =>
                    mainAgentRoster.findIndex((e) => e.agent.id === id)
                  }
                />
              </div>
            )}
          </>
        )}

        {/* Artifacts panel overlay — floats above bottom bar from bottom-right */}
        {artifactsPanelExpanded && !artifactsFullscreen && (
          <div
            className="pointer-events-none absolute bottom-2 right-3 z-40 hud-rise"
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
            className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center"
            aria-label="Expanded chat"
          >
            <div className="app-region-no-drag pointer-events-auto flex shrink-0 justify-center py-3 hud-drop">
              {collapseButton}
            </div>

            {/* Centered sheet — symmetric width regardless of side-panel sizes,
                so expanding never shifts the chat off-axis. */}
            <div className="flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-end px-4">
              <div
                className={`${PANEL} sheet-rise flex max-h-full min-h-0 flex-col rounded-b-none rounded-t-3xl border-b-0 shadow-sheet`}
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
                <div className="shrink-0 space-y-2 border-t border-line/10 px-4 py-3">
                  <RouteChoiceRow
                    awaitingRoute={awaitingRoute}
                    onChooseRoute={onChooseRoute}
                    upgradeable={upgradeable}
                    onUpgradeCommand={onUpgradeCommand}
                  />
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
              routeChoice={
                <RouteChoiceRow
                  awaitingRoute={awaitingRoute}
                  onChooseRoute={onChooseRoute}
                  upgradeable={upgradeable}
                  onUpgradeCommand={onUpgradeCommand}
                />
              }
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

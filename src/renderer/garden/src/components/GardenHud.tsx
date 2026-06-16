import React, { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  type WorkRunPlan,
} from "../domain/gardenDomain";
import type { Agent, Berry } from "../domain/gardenDomain";
import type { MainAgentRosterEntry } from "../domain/gardenRoster";
import { commandPreview, getCommandRosterStatus } from "../domain/gardenRoster";
import type {
  AgentDirectoryApproval,
  AgentDirectoryRow,
  AgentDirectoryView,
} from "../domain/agentDirectory";
import type { RunControlsView } from "../domain/runControlsView";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";

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
  runControls: RunControlsView;
  selectedWorkRunPlan?: WorkRunPlan;
  selectedWorkRunPlanStatus?: "drafting" | "ready";
  onAdvanceWorkRun?: () => void;
  onCompleteWorkRun?: (sourceChoice: SourceBerryChoice) => void;
  onPauseWorkRun?: () => void;
  onRetryWorkRun?: () => void;
  agentDirectory: AgentDirectoryView;
  mainAgentRoster: MainAgentRosterEntry[];
  activeMainAgentRoster: MainAgentRosterEntry[];
  recentAgentIds: string[];
  selectedMainAgentId: string | null;
  onSelectMainAgent: (mainAgentId: string) => void;
  onNewCommand: () => void;
  onMarkCommandDone: (commandId: string) => void;
  onReopenCommand: (commandId: string) => void;
  onApprovePlanForWorkRun: (workRunId: string) => void;
  onResolveApproval: (approved: boolean) => void;
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
  /** Multi-garden directory (PRD stories 18–22). */
  gardenName: string;
  gardens: string[];
  onSwitchGarden: (name: string) => void;
  /** Promote the selected Berry into this garden (Scratch → project). */
  promoteTarget?: string;
  onPromoteSelected?: () => void;
}

const MINIMAP_WIDTH = 128;
const MINIMAP_HEIGHT = 88;
const WORLD_VIEW_RADIUS = 1200;
const LEFT_SIDE_WIDTH = "17.5rem";
/** Width of the dedicated right HUD column (roster + run controls). */
export const GARDEN_RIGHT_HUD_WIDTH = "20rem";

/** Shared chrome surface — one restrained panel treatment for all HUD slabs. */
const PANEL =
  "app-region-no-drag pointer-events-auto border border-line/10 bg-surface-0/92 backdrop-blur-xl";
const SECTION_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint";

const CommandInput: React.FC<{
  commandText: string;
  onCommandTextChange: (value: string) => void;
  onSubmit: () => void;
  onNewCommand: () => void;
}> = ({ commandText, onCommandTextChange, onSubmit, onNewCommand }) => {
  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="app-region-no-drag relative w-full shrink-0"
    >
      <input
        value={commandText}
        onChange={(event) => onCommandTextChange(event.target.value)}
        className="w-full rounded-2xl border border-line/12 bg-surface-2/80 py-3 pl-12 pr-12 text-sm text-ink outline-none backdrop-blur-md transition-colors placeholder:text-ink-faint focus:border-accent/60"
        placeholder="Command the garden…"
      />
      <button
        type="button"
        onClick={onNewCommand}
        className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-accent"
        title="New command"
        aria-label="New command"
      >
        <Plus className="size-4" />
      </button>
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

/**
 * Inline tool/action trace under an agent turn — the steps the agent actually
 * took (navigate, read, extract, write…), collapsed by default. This replaces
 * the standalone Command Log: the conversation now carries its own execution
 * record, so there's a single timeline instead of two surfaces.
 */
const TraceDisclosure: React.FC<{ trace: CommandLogEntry["trace"] }> = ({
  trace,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mr-auto mt-1.5 max-w-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-line/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint transition-colors hover:text-ink"
      >
        <ChevronDown
          className={`size-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {trace.length} {trace.length === 1 ? "step" : "steps"}
      </button>
      {open && (
        <ol className="mt-1.5 flex flex-col gap-1 border-l border-line/10 pl-3">
          {trace.map((event) => (
            <li
              key={event.id}
              className="flex items-baseline gap-2 font-mono text-[10px]"
            >
              <span className="shrink-0 uppercase tracking-wide text-ink-faint">
                {event.kind}
              </span>
              <span className="min-w-0 flex-1 text-ink-muted">
                {event.label}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

/** One conversational turn: your command, the steps it took, the agent reply. */
const CommandTurn: React.FC<{ entry: CommandLogEntry }> = ({ entry }) => (
  <div className="space-y-2">
    <ChatMessage role="user" text={entry.text} />
    {entry.trace.length > 0 && <TraceDisclosure trace={entry.trace} />}
    {entry.response && <ChatMessage role="agent" text={entry.response} />}
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
      const point = toMini(
        berry.x + berry.width / 2,
        berry.y + berry.height / 2,
      );
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

const DirectoryRow: React.FC<{
  row: AgentDirectoryRow;
  selected: boolean;
  onSelect: () => void;
  onMarkDone: () => void;
  onReopen: () => void;
  onApprovePlan: () => void;
  onApproveAction: () => void;
  onDenyAction: () => void;
}> = ({
  row,
  selected,
  onSelect,
  onMarkDone,
  onReopen,
  onApprovePlan,
  onApproveAction,
  onDenyAction,
}) => {
  const done = row.status === "done";
  return (
    <li data-agent-row={row.agentId}>
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
          <span className="line-clamp-2 min-w-0 text-sm font-medium leading-snug text-ink">
            {row.taskTitle}
          </span>
          <Badge variant={done ? "done" : "active"} size="xs">
            {done ? "Done" : "Active"}
          </Badge>
        </div>
        <p className="mt-1 font-mono text-[10px] text-ink-faint">
          {row.currentLabel}
        </p>
      </button>
      {row.approval.kind === "approve-plan" && (
        <div className="mt-1 px-1">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={onApprovePlan}
          >
            Approve plan
          </Button>
        </div>
      )}
      {row.approval.kind === "approve-action" && (
        <div className="mt-1 grid grid-cols-2 gap-1 px-1">
          <Button variant="primary" size="sm" onClick={onApproveAction}>
            Approve
          </Button>
          <Button variant="ghost" size="sm" onClick={onDenyAction}>
            Deny
          </Button>
        </div>
      )}
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
  directory: AgentDirectoryView;
  selectedMainAgentId: string | null;
  onSelectMainAgent: (mainAgentId: string) => void;
  onMarkCommandDone: (commandId: string) => void;
  onReopenCommand: (commandId: string) => void;
  onApprovePlanForWorkRun: (workRunId: string) => void;
  onResolveApproval: (approved: boolean) => void;
  rosterCycleHint: string | null;
  onDismissRosterHint: () => void;
  berryCount: number;
  onToggleExpanded: () => void;
}> = ({
  directory,
  selectedMainAgentId,
  onSelectMainAgent,
  onMarkCommandDone,
  onReopenCommand,
  onApprovePlanForWorkRun,
  onResolveApproval,
  rosterCycleHint,
  onDismissRosterHint,
  berryCount,
  onToggleExpanded,
}) => {
  const [doneOpen, setDoneOpen] = useState(false);
  const renderRow = (row: AgentDirectoryRow): React.ReactNode => (
    <DirectoryRow
      key={row.agentId}
      row={row}
      selected={row.agentId === selectedMainAgentId}
      onSelect={() => onSelectMainAgent(row.agentId)}
      onMarkDone={() => onMarkCommandDone(row.commandId)}
      onReopen={() => onReopenCommand(row.commandId)}
      onApprovePlan={() =>
        row.workRunId && onApprovePlanForWorkRun(row.workRunId)
      }
      onApproveAction={() => onResolveApproval(true)}
      onDenyAction={() => onResolveApproval(false)}
    />
  );

  return (
    <div
      className={`${PANEL} hud-rise flex h-full min-h-0 w-full flex-col border-r-0 border-y-0 shadow-panel`}
      aria-label="Main Agent directory"
    >
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-line/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className={SECTION_LABEL}>Main Agents</p>
          <button
            type="button"
            onClick={onToggleExpanded}
            className="rounded-lg p-1 text-ink-faint transition-colors hover:text-ink"
            aria-label="Collapse directory"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
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
        <div className="space-y-4 px-2 py-3">
          {directory.active.length + directory.done.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-ink-faint">
              No Main Agents yet.
              <br />
              Use + beside the command input.
            </p>
          ) : (
            <>
              <section>
                <p className={`${SECTION_LABEL} mb-2 px-1`}>Active</p>
                <ol className="flex flex-col gap-2">
                  {directory.active.length === 0 ? (
                    <li className="px-2 py-3 text-xs text-ink-faint">
                      No active agents.
                    </li>
                  ) : (
                    directory.active.map(renderRow)
                  )}
                </ol>
              </section>
              {directory.done.length > 0 && (
                <section>
                  <button
                    type="button"
                    className={`${SECTION_LABEL} mb-2 flex w-full items-center gap-1 px-1 text-left`}
                    onClick={() => setDoneOpen((open) => !open)}
                  >
                    {doneOpen ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                    Done
                    <span className="text-ink-faint">
                      ({directory.done.length})
                    </span>
                  </button>
                  {doneOpen && (
                    <ol className="flex flex-col gap-2">
                      {directory.done.map(renderRow)}
                    </ol>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-line/10 px-3 py-2.5">
        <p className="text-center font-mono text-[10px] text-ink-faint">
          {berryCount} {berryCount === 1 ? "berry" : "berries"} · ⌥Tab cycles
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
};

// Keep original alias for HudBottomRight which uses a different name
const ARTIFACT_ICON = ARTIFACT_ICONS;

const artifactIconFor = (
  kind: BerryKind,
): React.ComponentType<{ className?: string }> =>
  ARTIFACT_ICON[kind] ?? FileText;

type ArtifactKindFilter = BerryKind | "all";

const ARTIFACT_KIND_FILTERS: { id: ArtifactKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sheet", label: "Sheet" },
  { id: "report", label: "Report" },
  { id: "lead", label: "Lead" },
  { id: "xlsx", label: "XLSX" },
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
    [artifacts],
  );

  const filtered = useMemo(
    () =>
      kindFilter === "all"
        ? artifacts
        : artifacts.filter((a) => a.kind === kindFilter),
    [artifacts, kindFilter],
  );

  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, LedgerEntry[]>>((acc, entry) => {
        (acc[entry.workRunTitle] ??= []).push(entry);
        return acc;
      }, {}),
    [filtered],
  );

  return (
    <div
      className={`${PANEL} flex max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl shadow-panel`}
      aria-label="Artifact roster"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-line/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className={SECTION_LABEL}>Artifacts</p>
          {headerActions}
        </div>
        <div className="flex flex-wrap gap-1">
          {ARTIFACT_KIND_FILTERS.filter(
            (f) => f.id === "all" || visibleKinds.has(f.id as BerryKind),
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
          <div className="flex min-h-36 flex-col items-center justify-center px-4 py-8 text-center">
            <p className="text-sm font-medium text-ink-muted">
              No artifacts yet
            </p>
            <p className="mt-1 max-w-48 text-xs leading-relaxed text-ink-faint">
              Approve a Work Run to produce them.
            </p>
          </div>
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
          {artifacts.length} {artifacts.length === 1 ? "artifact" : "artifacts"}{" "}
          · ⌘I full view
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
}> = ({
  artifacts,
  agentLabel,
  onSelectArtifact,
  onOpenLedger,
  panelExpanded,
  onTogglePanel,
}) => {
  const lastArtifact = artifacts[artifacts.length - 1];
  const extra = artifacts.length - 1;
  const canExpand = artifacts.length > 0;

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
        {canExpand && (
          <button
            type="button"
            onClick={onTogglePanel}
            className="ml-auto shrink-0 rounded-lg border border-line/10 bg-white/[0.03] p-1 text-ink-faint transition-colors hover:border-accent/40 hover:text-accent"
            aria-label={
              panelExpanded ? "Collapse artifacts" : "Expand artifacts"
            }
          >
            {panelExpanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronUp className="size-3" />
            )}
          </button>
        )}
      </div>

      {artifacts.length === 0 ? (
        <p className="text-[11px] leading-tight text-ink-faint">
          No outputs yet
        </p>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          {lastArtifact &&
            (() => {
              const Icon = artifactIconFor(lastArtifact.kind);
              return (
                <button
                  type="button"
                  onClick={() => onSelectArtifact(lastArtifact.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line/10 bg-white/[0.03] px-2 py-1.5 text-left transition-colors hover:border-accent/40 hover:bg-white/[0.07]"
                  title={`${lastArtifact.title} · ${lastArtifact.kind}`}
                >
                  <Icon className="size-3.5 shrink-0 text-accent" />
                  <span className="truncate text-[11px] text-ink">
                    {lastArtifact.title}
                  </span>
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
  directory: AgentDirectoryView;
  selectedMainAgentId: string | null;
  onSelect: (mainAgentId: string) => void;
  onExpand: () => void;
}> = ({ entries, directory, selectedMainAgentId, onSelect, onExpand }) => (
  <div
    className={`${PANEL} hud-fade flex flex-col items-center gap-2 rounded-l-2xl border-r-0 p-2 shadow-panel`}
    aria-label="Agent rail"
  >
    {entries.map((entry) => {
      const selected = entry.agent.id === selectedMainAgentId;
      const done = getCommandRosterStatus(entry.command) === "completed";
      const row = [...directory.active, ...directory.done].find(
        (candidate) => candidate.agentId === entry.agent.id,
      );
      const blocked = row?.approval.kind !== "none";
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
          title={`${commandPreview(entry.command)} — ${entry.agent.currentLabel}`}
          aria-label={`Select ${commandPreview(entry.command)}`}
        >
          <Bot className="size-4" />
          <span
            className={`absolute -right-0.5 -top-0.5 size-2 rounded-full ${
              done ? "bg-tm-complete" : "animate-pulse bg-accent"
            }`}
          />
          {blocked && (
            <span className="absolute -bottom-1 -right-1 size-3 rounded-full bg-tm-blocker ring-2 ring-surface-0" />
          )}
        </button>
      );
    })}
    <button
      type="button"
      onClick={onExpand}
      className="flex size-10 items-center justify-center rounded-full border border-line/12 bg-surface-1/70 text-ink-faint transition-colors hover:border-accent/40 hover:text-ink"
      title="Open agent directory"
      aria-label="Open agent directory"
    >
      <ChevronLeft className="size-3.5" />
    </button>
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
        <Button
          variant="subtle"
          size="sm"
          onClick={() => onChooseRoute("quick")}
        >
          Answer quickly
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onChooseRoute("work-run")}
        >
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

const InlinePlanPreview: React.FC<{ plan: WorkRunPlan }> = ({ plan }) => {
  const columns = plan.outputColumns.slice(0, 4).join(", ");
  const destination = plan.destination.backup
    ? `${plan.destination.primary} + ${plan.destination.backup}`
    : plan.destination.primary;

  return (
    <div className="grid min-w-[18rem] max-w-xl flex-1 gap-1.5 rounded-xl border border-line/10 bg-white/[0.03] p-2 text-left text-[11px] leading-snug text-ink-muted">
      <p className="text-xs text-ink">{plan.summary}</p>
      <div className="grid gap-1 sm:grid-cols-2">
        <p>
          <span className="text-ink-faint">Sources:</span>{" "}
          {plan.sources.slice(0, 3).join(", ")}
        </p>
        <p>
          <span className="text-ink-faint">Output:</span> {columns}
          {plan.outputColumns.length > 4 ? "..." : ""}
        </p>
        <p>
          <span className="text-ink-faint">Criteria:</span>{" "}
          {plan.qualificationCriteria.slice(0, 2).join("; ")}
        </p>
        <p>
          <span className="text-ink-faint">Destination:</span> {destination}
        </p>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        Checkpoints: {plan.approvalCheckpoints.slice(0, 2).join(" / ")}
      </p>
    </div>
  );
};

/**
 * The single Work Run control surface, living in the center command hub right
 * above the command input. Everything that can happen to the selected Main
 * Agent's run is here, one place, in lifecycle order:
 *   approve plan → (running) Advance / Pause → (blocked) Retry / (interrupted)
 *   Resume → Approve / Deny an action → (done) Finish.
 * It stays a compact single row so it never grows the chat.
 */
const RunControlStrip: React.FC<{
  controls: RunControlsView;
  approval: AgentDirectoryApproval;
  approvalWorkRunId?: string;
  plan?: WorkRunPlan;
  planStatus?: "drafting" | "ready";
  onAdvanceWorkRun?: () => void;
  onCompleteWorkRun?: (sourceChoice: SourceBerryChoice) => void;
  onPauseWorkRun?: () => void;
  onRetryWorkRun?: () => void;
  onApprovePlanForWorkRun: (workRunId: string) => void;
  onResolveApproval: (approved: boolean) => void;
}> = ({
  controls,
  approval,
  approvalWorkRunId,
  plan,
  planStatus,
  onAdvanceWorkRun,
  onCompleteWorkRun,
  onPauseWorkRun,
  onRetryWorkRun,
  onApprovePlanForWorkRun,
  onResolveApproval,
}) => {
  const needsPlan = approval.kind === "approve-plan";
  const needsAction = approval.kind === "approve-action";
  const isDraftingPlan = planStatus === "drafting";
  const hasLifecycle =
    controls.advance.visible ||
    controls.pause.visible ||
    controls.retry.visible ||
    controls.complete.visible;

  if (!needsPlan && !needsAction && !hasLifecycle && !isDraftingPlan) {
    return null;
  }

  const label = isDraftingPlan
    ? "Drafting plan from prompt"
    : needsPlan
      ? "Plan ready — approve to start"
      : needsAction
        ? "Agent needs approval to act"
        : controls.complete.visible
          ? "Work Run complete"
          : controls.retry.visible
            ? "Run needs attention"
            : "Work Run running";

  const accent =
    needsAction || needsPlan || isDraftingPlan
      ? "border-tm-blocker/40 text-tm-blocker"
      : controls.complete.visible
        ? "border-tm-complete/40 text-tm-complete"
        : "border-line/10 text-ink-faint";

  return (
    <div
      className={`pointer-events-auto hud-rise flex max-w-3xl flex-wrap items-start justify-center gap-2 rounded-2xl border bg-surface-0/82 px-3 py-2 backdrop-blur-xl ${accent}`}
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]">
        {controls.complete.visible && <CheckCircle2 className="size-3.5" />}
        {label}
      </span>
      {(needsPlan || needsAction || hasLifecycle) && (
        <span className="h-4 w-px bg-line/15" aria-hidden />
      )}

      {/* Approval gates take priority over lifecycle controls. */}
      {needsPlan && approvalWorkRunId && (
        <>
          {plan && <InlinePlanPreview plan={plan} />}
          <Button
            variant="primary"
            size="sm"
            onClick={() => onApprovePlanForWorkRun(approvalWorkRunId)}
          >
            Approve plan
          </Button>
        </>
      )}
      {needsAction && (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onResolveApproval(true)}
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolveApproval(false)}
          >
            Deny
          </Button>
        </>
      )}

      {!needsPlan && !needsAction && (
        <>
          {controls.advance.visible && onAdvanceWorkRun && (
            <Button
              variant="outline"
              size="sm"
              disabled={!controls.advance.enabled}
              onClick={onAdvanceWorkRun}
            >
              Advance
            </Button>
          )}
          {controls.pause.visible && onPauseWorkRun && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!controls.pause.enabled}
              onClick={onPauseWorkRun}
            >
              Pause
            </Button>
          )}
          {controls.retry.visible && onRetryWorkRun && (
            <Button
              variant="primary"
              size="sm"
              disabled={!controls.retry.enabled}
              onClick={onRetryWorkRun}
            >
              {controls.retry.label}
            </Button>
          )}
          {controls.complete.visible && onCompleteWorkRun && (
            <Button
              variant="success"
              size="sm"
              disabled={!controls.complete.enabled}
              onClick={() => onCompleteWorkRun("collapse")}
            >
              Finish
            </Button>
          )}
        </>
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
  onNewCommand: () => void;
  runControlStrip: React.ReactNode;
  expandButton: React.ReactNode;
  routeChoice: React.ReactNode;
}> = ({
  latestAgentReply,
  commandText,
  onCommandTextChange,
  onSubmit,
  onNewCommand,
  runControlStrip,
  expandButton,
  routeChoice,
}) => (
  // Same max-w-3xl column as the expanded chat sheet, so the input keeps one
  // width and one axis across collapsed/expanded states — no resize jump.
  <div className="pointer-events-none flex w-full max-w-3xl flex-col justify-end gap-2 px-4 pb-3 pt-2 hud-rise">
    <div className="pointer-events-auto flex justify-center">
      {expandButton}
    </div>
    {routeChoice}
    {latestAgentReply && (
      <div className="pointer-events-auto relative max-h-[5.5rem] px-1 text-center hud-fade">
        <p className="line-clamp-4 text-sm leading-relaxed text-accent-strong/85">
          {latestAgentReply}
        </p>
      </div>
    )}
    {runControlStrip}
    <div className="pointer-events-auto w-full">
      <CommandInput
        commandText={commandText}
        onCommandTextChange={onCommandTextChange}
        onSubmit={onSubmit}
        onNewCommand={onNewCommand}
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
    runControls,
    selectedWorkRunPlan,
    selectedWorkRunPlanStatus,
    onAdvanceWorkRun,
    onCompleteWorkRun,
    onPauseWorkRun,
    onRetryWorkRun,
    agentDirectory,
    mainAgentRoster,
    activeMainAgentRoster,
    recentAgentIds,
    selectedMainAgentId,
    onSelectMainAgent,
    onNewCommand,
    onMarkCommandDone,
    onReopenCommand,
    onApprovePlanForWorkRun,
    onResolveApproval,
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
    promoteTarget,
    onPromoteSelected,
  } = props;

  const [chatExpanded, setChatExpanded] = useState(false);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  /** Right-edge hover reveals the full agent rail. */
  const [railHovered, setRailHovered] = useState(false);
  /** Tab-cycling transiently surfaces the recent-agents rail. */
  const [cycleRailVisible, setCycleRailVisible] = useState(false);
  const [artifactsPanelExpanded, setArtifactsPanelExpanded] = useState(false);
  const [artifactsFullscreen, setArtifactsFullscreen] = useState(false);
  const artifactsExpanded = artifactsPanelExpanded && allArtifacts.length > 0;

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
    if (allArtifacts.length > 0) return;
    setArtifactsPanelExpanded(false);
    setArtifactsFullscreen(false);
  }, [allArtifacts.length]);

  useEffect(() => {
    setArtifactsPanelExpanded(false);
  }, [selectedMainAgentId, commandText]);

  // Transiently surface the recent-agents rail when selection changes.
  useEffect(() => {
    if (!selectedMainAgentId) return;
    setCycleRailVisible(true);
    const t = setTimeout(() => setCycleRailVisible(false), 1500);
    return () => clearTimeout(t);
  }, [selectedMainAgentId]);

  useEffect(() => {
    if (!agentDirectory.hasActionApproval || !rightPanelExpanded) return;
    const blockedRow = [...agentDirectory.active, ...agentDirectory.done].find(
      (row) => row.approval.kind === "approve-action",
    );
    window.setTimeout(() => {
      document
        .querySelector(`[data-agent-row="${blockedRow?.agentId ?? ""}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
  }, [
    agentDirectory.hasActionApproval,
    rightPanelExpanded,
    agentDirectory.active,
    agentDirectory.done,
  ]);

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
      MINIMAP_HEIGHT / (WORLD_VIEW_RADIUS * 2),
    );
    const toMini = (wx: number, wy: number): { left: number; top: number } => ({
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

  // The selected Main Agent's pending approval (if any) — surfaced inline in the
  // center command hub alongside the run lifecycle controls.
  const selectedRow = [...agentDirectory.active, ...agentDirectory.done].find(
    (row) => row.agentId === selectedMainAgentId,
  );
  const runControlStrip = (
    <RunControlStrip
      controls={runControls}
      approval={selectedRow?.approval ?? { kind: "none" }}
      approvalWorkRunId={selectedRow?.workRunId}
      plan={selectedWorkRunPlan}
      planStatus={selectedWorkRunPlanStatus}
      onAdvanceWorkRun={onAdvanceWorkRun}
      onCompleteWorkRun={onCompleteWorkRun}
      onPauseWorkRun={onPauseWorkRun}
      onRetryWorkRun={onRetryWorkRun}
      onApprovePlanForWorkRun={onApprovePlanForWorkRun}
      onResolveApproval={onResolveApproval}
    />
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex flex-col"
      aria-label="Garden HUD chrome"
    >
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
        {/* Promote affordance — the Garden directory now lives in the top bar
            (right of the URL bar); only the berry-contextual Promote stays here. */}
        {promoteTarget && onPromoteSelected && (
          <div className="pointer-events-auto absolute right-3 top-3 z-40">
            <button
              type="button"
              onClick={onPromoteSelected}
              className={`${PANEL} hud-fade rounded-full border-accent/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-accent transition-colors hover:bg-accent/10`}
              title={`Move the selected Berry into ${promoteTarget}`}
            >
              Promote → {promoteTarget}
            </button>
          </div>
        )}
        {/* Agents right column — hidden rail (hover / cycle) or expanded roster */}
        {rightPanelExpanded ? (
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 z-40 flex flex-col"
            style={{ width: GARDEN_RIGHT_HUD_WIDTH }}
            aria-label="Garden right HUD"
          >
            <MainAgentRosterPanel
              directory={agentDirectory}
              selectedMainAgentId={selectedMainAgentId}
              onSelectMainAgent={onSelectMainAgent}
              onMarkCommandDone={onMarkCommandDone}
              onReopenCommand={onReopenCommand}
              onApprovePlanForWorkRun={onApprovePlanForWorkRun}
              onResolveApproval={onResolveApproval}
              rosterCycleHint={rosterCycleHint}
              onDismissRosterHint={onDismissRosterHint}
              berryCount={berries.length}
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
            {(railHovered || cycleRailVisible) &&
              mainAgentRoster.length > 0 && (
                <div
                  className="pointer-events-auto absolute right-0 top-1/2 z-40 -translate-y-1/2"
                  onMouseEnter={() => setRailHovered(true)}
                  onMouseLeave={() => setRailHovered(false)}
                >
                  <AgentRail
                    entries={
                      railHovered
                        ? mainAgentRoster
                        : // Cycling: only active, recently selected agents.
                          recentAgentIds
                            .map((id) =>
                              activeMainAgentRoster.find(
                                (e) => e.agent.id === id,
                              ),
                            )
                            .filter((e): e is MainAgentRosterEntry =>
                              Boolean(e),
                            )
                    }
                    directory={agentDirectory}
                    selectedMainAgentId={selectedMainAgentId}
                    onSelect={onSelectMainAgent}
                    onExpand={() => setRightPanelExpanded(true)}
                  />
                </div>
              )}
          </>
        )}

        {/* Artifacts panel overlay — floats above bottom bar from bottom-right */}
        {artifactsExpanded && !artifactsFullscreen && (
          <div
            className="pointer-events-none absolute right-4 z-50 hud-rise"
            style={{
              bottom: "calc(88px + 0.75rem)",
              width: "min(27rem, calc(100vw - 2rem))",
              maxHeight: "min(26rem, calc(100% - 7rem))",
            }}
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
                    {commandLog.length === 0 && !latestAgentReply ? (
                      <p className="py-8 text-center text-sm text-ink-faint">
                        No commands yet — command the garden below.
                      </p>
                    ) : (
                      commandLog.map((entry) => (
                        <CommandTurn key={entry.commandId} entry={entry} />
                      ))
                    )}
                    {/* Live in-progress reply, only until it lands as a turn. */}
                    {latestAgentReply && !commandLog.at(-1)?.response && (
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
                  {runControlStrip}
                  <CommandInput
                    commandText={commandText}
                    onCommandTextChange={onCommandTextChange}
                    onSubmit={onSubmit}
                    onNewCommand={onNewCommand}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="pointer-events-none grid w-full shrink-0 items-center border-t border-line/10"
        style={{
          gridTemplateColumns: `${LEFT_SIDE_WIDTH} 1fr ${LEFT_SIDE_WIDTH}`,
        }}
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
              onNewCommand={onNewCommand}
              runControlStrip={runControlStrip}
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
        {artifactsExpanded ? (
          <div
            className={`${PANEL} flex h-[88px] shrink-0 items-center justify-between border-b-0 border-l border-r-0 border-t-0 px-4`}
            style={{ width: LEFT_SIDE_WIDTH }}
            aria-label="Artifacts shelf"
          >
            <div className="min-w-0">
              <p className={SECTION_LABEL}>Artifacts</p>
              <p className="mt-1 truncate text-xs text-ink-faint">
                Expanded above
              </p>
            </div>
            <button
              type="button"
              onClick={() => setArtifactsPanelExpanded(false)}
              className="shrink-0 rounded-lg border border-line/12 bg-surface-2 p-1.5 text-ink-faint transition-colors hover:border-accent/40 hover:text-ink"
              aria-label="Collapse artifacts"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        ) : (
          <ArtifactsShelf
            artifacts={bottomArtifacts}
            agentLabel={bottomArtifactsLabel}
            onSelectArtifact={onSelectArtifact}
            onOpenLedger={onOpenLedger}
            panelExpanded={artifactsExpanded}
            onTogglePanel={() => setArtifactsPanelExpanded((v) => !v)}
          />
        )}
      </div>
    </div>
  );
};

export function replyForCommand(
  route: "quick" | "work-run",
  agentLabel?: string,
): string {
  if (agentLabel) return agentLabel;
  return route === "quick"
    ? "Quick answer stays here — deeper work will bloom on the garden."
    : "I'll plan visible browser work you can approve before it runs.";
}

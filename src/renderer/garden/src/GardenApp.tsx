import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  Crosshair,
  FileDown,
  FileSpreadsheet,
  FileText,
  Globe2,
  Sparkles,
} from "lucide-react";
import { Companion } from "./components/Companion";
import { TelemetryLayer } from "./components/TelemetryLayer";
import { clipForAgentState } from "./domain/telemetryVisuals";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import {
  fadeMessageOntoGarden,
  FadedGardenEcho,
  GARDEN_RIGHT_HUD_WIDTH,
  GardenHud,
  ViewportTransform,
} from "./components/GardenHud";
import { IntelLedgerOverlay } from "./components/IntelLedger";
import { ReaderPane } from "./components/ReaderPane";
import {
  Berry,
  createInitialGardenState,
  GardenState,
  getCommandLog,
  getLedgerEntries,
  getReaderContent,
  getVisibleBerries,
  TelemetryEvent,
  type SourceBerryChoice,
} from "./domain/gardenDomain";
import {
  cycleMainAgentId,
  getMainAgentRoster,
  loadMainAgentCycleScope,
  rosterHintForEmptyScope,
  saveMainAgentCycleScope,
  type MainAgentCycleScope,
} from "./domain/gardenRoster";

/** Main-process state broadcast envelope (mirrors src/main/garden/channels.ts). */
interface GardenSnapshot {
  state: GardenState;
  pendingApproval: PendingApproval | null;
}
interface PendingApproval {
  id: string;
  agentId: string;
  commandId?: string;
  caption: string;
  reason: string;
}

const DEMO_COMMAND =
  "Look at Strawberry's product and sales prospecting pages. Infer who they sell to. Then search the web for 10 companies that might buy Blueberry. Write them to Google Sheets with evidence and outreach angles. Keep an XLSX backup.";

const berryIcon = {
  tab: Globe2,
  sheet: FileSpreadsheet,
  xlsx: FileDown,
  lead: Sparkles,
  report: FileText,
  "work-run": Archive,
};

export const GardenApp: React.FC = () => {
  const [state, setState] = useState<GardenState>(() =>
    createInitialGardenState(),
  );
  const [commandText, setCommandText] = useState(DEMO_COMMAND);
  const [selectedMainAgentId, setSelectedMainAgentId] = useState<string | null>(
    null,
  );
  const [mainAgentCycleScope, setMainAgentCycleScope] =
    useState<MainAgentCycleScope>(loadMainAgentCycleScope);
  const [rosterCycleHint, setRosterCycleHint] = useState<string | null>(null);
  const rosterSeededRef = useRef(false);
  const [selectedBerryId, setSelectedBerryId] = useState<string | null>(null);
  const [readerBerryId, setReaderBerryId] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [latestAgentReply, setLatestAgentReply] = useState<string | null>(null);
  const [hasRealAgent, setHasRealAgent] = useState(false);
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);
  const [gardenEchoes, setGardenEchoes] = useState<FadedGardenEcho[]>([]);
  // Camera (stories 42–44): commanded center target + follow-the-agent mode.
  const [cameraTarget, setCameraTarget] = useState<{
    x: number;
    y: number;
    nonce: number;
  } | null>(null);
  const [followAgent, setFollowAgent] = useState(false);
  const [viewport, setViewport] = useState<ViewportTransform>({
    panX: 0,
    panY: 0,
    zoom: 1,
    width: 800,
    height: 600,
  });

  const mainAgentRoster = useMemo(
    () => getMainAgentRoster(state, mainAgentCycleScope),
    [state, mainAgentCycleScope],
  );

  const selectedCommand = useMemo(
    () =>
      state.commands.find(
        (command) => command.mainAgentId === selectedMainAgentId,
      ),
    [state.commands, selectedMainAgentId],
  );

  const selectedWorkRun = useMemo(
    () =>
      selectedCommand?.workRunId
        ? state.workRuns.find((run) => run.id === selectedCommand.workRunId)
        : undefined,
    [state.workRuns, selectedCommand?.workRunId],
  );

  const plannedWorkRun =
    selectedWorkRun?.status === "planning" ? selectedWorkRun : undefined;
  const runningWorkRun =
    selectedWorkRun?.status === "running" ? selectedWorkRun : undefined;
  const completedWorkRun =
    selectedWorkRun?.status === "complete" ? selectedWorkRun : undefined;

  const mainAgent = state.agents.find(
    (agent) => agent.id === selectedMainAgentId,
  );

  // Routing affordances (PRD stories 14–15) for the selected command.
  const awaitingRoute = selectedCommand?.status === "awaiting-route";
  const upgradeable =
    selectedCommand?.route === "quick" &&
    selectedCommand.status === "complete" &&
    !selectedCommand.workRunId;

  // Surface the Main Agent's compact quick reply when it lands (broadcast).
  useEffect(() => {
    if (selectedCommand?.response) {
      setLatestAgentReply(selectedCommand.response);
    }
  }, [selectedCommand?.response]);
  const visibleBerries = getVisibleBerries(state);
  const ledgerEntries = getLedgerEntries(state);
  const commandLog = useMemo(() => getCommandLog(state), [state]);

  // All artifact berries (non-tab, across all work runs) for the Artifact Roster panel.
  const allArtifacts = useMemo(
    () =>
      getLedgerEntries(state).filter(
        (entry) => entry.kind !== "tab" && !entry.browserTabId,
      ),
    [state],
  );

  // Bottom-right HUD "Outputs" shelf: the Artifact Berries the selected Main
  // Agent's Work Run produced (its RTS-style inventory). Tabs are excluded —
  // they live on the map / left sidebar, not in the output shelf.
  const selectedAgentArtifacts = useMemo(() => {
    const runId = selectedCommand?.workRunId;
    if (!runId) return [];
    return state.berries.filter(
      (berry) =>
        berry.workRunId === runId &&
        berry.kind !== "tab" &&
        !berry.browserTabId,
    );
  }, [state.berries, selectedCommand?.workRunId]);

  const selectedAgentIndex = mainAgentRoster.findIndex(
    (entry) => entry.agent.id === selectedMainAgentId,
  );
  const selectedAgentLabel =
    selectedAgentIndex >= 0
      ? `Main Agent ${selectedAgentIndex + 1}`
      : undefined;
  const readerBerry = state.berries.find((berry) => berry.id === readerBerryId);
  const readerContent = readerBerry ? getReaderContent(readerBerry) : null;

  // Seed from the main-owned store and subscribe to full-snapshot broadcasts
  // (ADR-0003): main is the source of truth, this renderer is a view.
  useEffect(() => {
    let mounted = true;

    const seedRoster = async (snapshot: GardenSnapshot): Promise<void> => {
      if (rosterSeededRef.current) return;
      rosterSeededRef.current = true;
      if (snapshot.state.commands.length === 0) {
        const feedback = await window.gardenAPI?.dispatch({
          type: "new-command",
        });
        if (feedback?.selectMainAgentId) {
          setSelectedMainAgentId(feedback.selectMainAgentId);
        }
      }
    };

    window.gardenAPI
      ?.getState()
      .then((snapshot) => {
        if (!mounted || !snapshot) return;
        setState(snapshot.state as GardenState);
        setPendingApproval(snapshot.pendingApproval);
        void seedRoster(snapshot as GardenSnapshot);
      })
      .catch(() => {});

    const unsub = window.gardenAPI?.onGardenState((snapshot) => {
      const snap = snapshot as GardenSnapshot;
      setState(snap.state);
      setPendingApproval(snap.pendingApproval);
    });

    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (
      selectedMainAgentId &&
      mainAgentRoster.some((entry) => entry.agent.id === selectedMainAgentId)
    ) {
      return;
    }
    setSelectedMainAgentId(mainAgentRoster.at(-1)?.agent.id ?? null);
  }, [mainAgentRoster, selectedMainAgentId]);

  // Check once on mount whether a real API key is configured.
  useEffect(() => {
    window.gardenAPI
      ?.hasApiKey()
      .then(setHasRealAgent)
      .catch(() => {});
  }, []);

  // Pull real browser tabs into the garden as Tab Berries. getTabBerries is
  // expensive (screenshots every tab), so sync on mount and whenever the
  // garden becomes visible — not on a poll. The sync-tab-berries intent is
  // reduced in main (skips while a Work Run is active) and broadcast back.
  useEffect(() => {
    const pullTabs = (): void => {
      window.gardenAPI
        ?.getTabBerries()
        .then((snapshots) =>
          window.gardenAPI?.dispatch({ type: "sync-tab-berries", snapshots }),
        )
        .catch(() => {});
    };
    pullTabs();
    const unsub = window.gardenAPI?.onGardenShown(pullTabs);
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setLedgerOpen((open) => !open);
      }
      if (event.key === "Escape") {
        if (readerBerryId) {
          setReaderBerryId(null);
        } else if (ledgerOpen) {
          setLedgerOpen(false);
        } else if (rosterCycleHint) {
          setRosterCycleHint(null);
        }
      }
      const target = event.target as HTMLElement | null;
      const typing = Boolean(
        target?.closest("input, textarea, [contenteditable='true']"),
      );

      // Camera: C centers on the selection (berry, else agent); F follows.
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key.toLowerCase() === "c") {
          const berry = selectedBerryId
            ? state.berries.find((b) => b.id === selectedBerryId)
            : undefined;
          const point = berry
            ? { x: berry.x + berry.width / 2, y: berry.y + berry.height / 2 }
            : agentPosition;
          setCameraTarget((prev) => ({ ...point, nonce: (prev?.nonce ?? 0) + 1 }));
        }
        if (event.key.toLowerCase() === "f") {
          setFollowAgent((on) => !on);
        }
      }

      if (
        event.key !== "Tab" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (typing) {
        return;
      }

      event.preventDefault();
      const roster = getMainAgentRoster(state, mainAgentCycleScope);
      if (roster.length === 0) {
        setRosterCycleHint(rosterHintForEmptyScope(mainAgentCycleScope));
        return;
      }
      setRosterCycleHint(null);
      setSelectedMainAgentId(cycleMainAgentId(roster, selectedMainAgentId));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    ledgerOpen,
    readerBerryId,
    rosterCycleHint,
    state,
    mainAgentCycleScope,
    selectedMainAgentId,
    selectedBerryId,
  ]);

  useEffect(() => {
    if (!mainAgent || mainAgent.state === "idle") return;
    setLatestAgentReply(mainAgent.currentLabel);
  }, [mainAgent?.currentLabel, mainAgent?.state]);

  const agentPosition = useMemo(() => {
    if (!visibleBerries.length) return { x: 440, y: 310 };
    const target =
      visibleBerries.find((berry) => berry.status === "reading") ??
      visibleBerries[0];
    return {
      x: target.x + target.width - 22,
      y: target.y + target.height + 22,
    };
  }, [visibleBerries]);

  // Follow mode (story 42): keep the camera glued to the agent as it moves.
  useEffect(() => {
    if (!followAgent) return;
    setCameraTarget((prev) => ({
      ...agentPosition,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, [followAgent, agentPosition]);

  const handleSubmit = (): void => {
    const text = commandText.trim();
    if (!text) return;

    const superseded: FadedGardenEcho[] = [];
    if (latestAgentReply) {
      superseded.push({
        id: `echo-agent-${Date.now()}`,
        role: "agent",
        text: latestAgentReply,
        x: 0,
        y: 0,
      });
    }
    superseded.push({
      id: `echo-user-${Date.now()}`,
      role: "user",
      text,
      x: 0,
      y: 0,
    });

    setGardenEchoes((echoes) =>
      fadeMessageOntoGarden([...echoes, ...superseded], echoes.length),
    );

    // Dispatch to main (source of truth); the resulting state arrives via the
    // snapshot broadcast. Only the selection/hint feedback is returned here.
    void window.gardenAPI
      ?.dispatch({
        type: "submit-command",
        text,
        mainAgentId: selectedMainAgentId,
      })
      .then((feedback) => {
        if (feedback?.selectMainAgentId) {
          setSelectedMainAgentId(feedback.selectMainAgentId);
        }
        setRosterCycleHint(feedback?.hint ?? null);
      })
      .catch(() => {});
    setCommandText("");
  };

  const handleNewCommand = (): void => {
    setRosterCycleHint(null);
    void window.gardenAPI
      ?.dispatch({ type: "new-command" })
      .then((feedback) => {
        if (feedback?.selectMainAgentId) {
          setSelectedMainAgentId(feedback.selectMainAgentId);
        }
      })
      .catch(() => {});
    setCommandText("");
    setLatestAgentReply(null);
  };

  const handleMainAgentScopeChange = (scope: MainAgentCycleScope): void => {
    saveMainAgentCycleScope(scope);
    setMainAgentCycleScope(scope);
    const roster = getMainAgentRoster(state, scope);
    if (
      selectedMainAgentId &&
      !roster.some((entry) => entry.agent.id === selectedMainAgentId)
    ) {
      setSelectedMainAgentId(roster.at(-1)?.agent.id ?? null);
    }
  };

  const handleSelectMainAgent = (mainAgentId: string): void => {
    setRosterCycleHint(null);
    setSelectedMainAgentId(mainAgentId);
    const agent = state.agents.find(
      (candidate) => candidate.id === mainAgentId,
    );
    if (agent && agent.state !== "idle") {
      setLatestAgentReply(agent.currentLabel);
    }
  };

  const handleMarkCommandDone = (commandId: string): void => {
    void window.gardenAPI?.dispatch({ type: "mark-command-done", commandId });
  };

  const handleReopenCommand = (commandId: string): void => {
    void window.gardenAPI?.dispatch({ type: "reopen-command", commandId });
  };

  const handleChooseRoute = (route: "quick" | "work-run"): void => {
    if (!selectedCommand) return;
    void window.gardenAPI?.dispatch({
      type: "choose-route",
      commandId: selectedCommand.id,
      route,
    });
  };

  const handleUpgradeCommand = (): void => {
    if (!selectedCommand) return;
    void window.gardenAPI?.dispatch({
      type: "upgrade-command",
      commandId: selectedCommand.id,
    });
  };

  const handleApprovePlan = (): void => {
    if (!plannedWorkRun) return;
    // Main decides real-agent vs scripted-demo execution and broadcasts back.
    void window.gardenAPI?.dispatch({
      type: "approve-work-run",
      workRunId: plannedWorkRun.id,
    });
  };

  const handleResolveApproval = (approved: boolean): void => {
    if (!pendingApproval) return;
    void window.gardenAPI?.resolveApproval(pendingApproval.id, approved);
  };

  const handleOpenBerry = (berry: Berry): void => {
    // Tab Berry: enter the live browser tab (switches active tab + hides garden).
    if (berry.browserTabId) {
      void window.gardenAPI?.focusTab(berry.browserTabId);
      return;
    }
    if (berry.kind === "tab") return;

    if (berry.kind === "report") {
      setReaderBerryId(berry.id);
      return;
    }

    if (!berry.url) return;
    void window.gardenAPI?.openUrl(berry.url);
  };

  const handleSelectBerry = (berryId: string): void => {
    const berry = state.berries.find((candidate) => candidate.id === berryId);
    if (!berry) return;

    // Tab Berries are selectable (highlight); double-click enters them.
    setSelectedBerryId(berryId);
    if (berry.kind === "report") {
      setReaderBerryId(berryId);
    }
  };

  const handleAdvanceWorkRun = (): void => {
    if (!runningWorkRun) return;
    void window.gardenAPI?.dispatch({
      type: "advance-work-run",
      workRunId: runningWorkRun.id,
    });
  };

  const handleCompleteWorkRun = (sourceChoice: SourceBerryChoice): void => {
    const target = runningWorkRun ?? completedWorkRun;
    if (!target) return;
    void window.gardenAPI?.dispatch({
      type: "complete-work-run",
      workRunId: target.id,
      sourceChoice,
    });
  };

  const handlePauseWorkRun = (): void => {
    if (!runningWorkRun) return;
    void window.gardenAPI?.dispatch({
      type: "pause-work-run",
      workRunId: runningWorkRun.id,
    });
  };

  const handleRetryWorkRun = (): void => {
    if (!selectedWorkRun) return;
    void window.gardenAPI?.dispatch({
      type: "retry-work-run",
      workRunId: selectedWorkRun.id,
    });
  };

  const handleShowOnGarden = (berryId: string): void => {
    void window.gardenAPI?.dispatch({ type: "show-berry", berryId });
    setSelectedBerryId(berryId);
    setLedgerOpen(false);
  };

  // Berry switcher activation (⌘K): tabs enter the live tab; artifacts focus
  // on the canvas (reports open the reader).
  const handleActivateBerry = (berryId: string): void => {
    const berry = state.berries.find((candidate) => candidate.id === berryId);
    if (!berry) return;
    if (berry.browserTabId || berry.kind === "tab") {
      handleOpenBerry(berry);
      return;
    }
    handleFocusArtifact(berryId);
  };

  const handleFocusArtifact = (berryId: string): void => {
    const berry = state.berries.find((candidate) => candidate.id === berryId);
    if (!berry) return;
    if (!berry.onMap) {
      void window.gardenAPI?.dispatch({ type: "show-berry", berryId });
    }
    setSelectedBerryId(berryId);
    if (berry.kind === "report") setReaderBerryId(berryId);
  };

  const latestTelemetry = state.telemetry.at(-1);
  const companionClip = clipForAgentState(
    mainAgent?.state,
    latestTelemetry?.kind,
  );

  // A running Work Run is either agent-driven (real AgentRunner, requires an API
  // key) or the scripted demo state machine. The two are no longer swapped
  // silently — when the scripted engine is active we surface it explicitly.
  const isScriptedRun = Boolean(runningWorkRun) && !hasRealAgent;

  return (
    <main className="relative h-full w-full overflow-hidden bg-garden-base text-ink">
      {isScriptedRun && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2">
          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 font-mono text-[11px] text-amber-300 shadow-lift backdrop-blur-sm">
            Demo run — scripted steps (no API key; add one to .env for a real
            agent)
          </span>
        </div>
      )}
      <GardenWorld
        berries={visibleBerries}
        telemetry={state.telemetry}
        gardenEchoes={gardenEchoes}
        selectedBerryId={selectedBerryId}
        agentPosition={agentPosition}
        cameraTarget={cameraTarget}
        showMapAgent={Boolean(runningWorkRun)}
        companionClip={companionClip}
        companionBlocked={mainAgent?.state === "blocked"}
        onSelectBerry={handleSelectBerry}
        onOpenBerry={handleOpenBerry}
        onViewportChange={setViewport}
      />

      <GardenHud
        berries={visibleBerries}
        viewport={viewport}
        agent={mainAgent}
        latestAgentReply={latestAgentReply}
        awaitingRoute={awaitingRoute}
        onChooseRoute={handleChooseRoute}
        upgradeable={upgradeable}
        onUpgradeCommand={handleUpgradeCommand}
        commandText={commandText}
        onCommandTextChange={setCommandText}
        onSubmit={handleSubmit}
        plannedWorkRunTitle={plannedWorkRun?.title}
        onApprovePlan={plannedWorkRun ? handleApprovePlan : undefined}
        showWorkRunControls={Boolean(runningWorkRun || completedWorkRun)}
        onAdvanceWorkRun={runningWorkRun ? handleAdvanceWorkRun : undefined}
        onCompleteWorkRun={
          runningWorkRun || completedWorkRun ? handleCompleteWorkRun : undefined
        }
        workRunStatus={selectedWorkRun?.status}
        onPauseWorkRun={runningWorkRun ? handlePauseWorkRun : undefined}
        onRetryWorkRun={
          selectedWorkRun?.status === "blocked" ||
          selectedWorkRun?.status === "interrupted"
            ? handleRetryWorkRun
            : undefined
        }
        mainAgentRoster={mainAgentRoster}
        selectedMainAgentId={selectedMainAgentId}
        mainAgentCycleScope={mainAgentCycleScope}
        onMainAgentCycleScopeChange={handleMainAgentScopeChange}
        onSelectMainAgent={handleSelectMainAgent}
        onNewCommand={handleNewCommand}
        onMarkCommandDone={handleMarkCommandDone}
        onReopenCommand={handleReopenCommand}
        rosterCycleHint={rosterCycleHint}
        onDismissRosterHint={() => setRosterCycleHint(null)}
        bottomArtifacts={selectedAgentArtifacts}
        bottomArtifactsLabel={selectedAgentLabel}
        onSelectArtifact={handleFocusArtifact}
        onOpenLedger={() => setLedgerOpen(true)}
        allArtifacts={allArtifacts}
        commandLog={commandLog}
        switcherEntries={ledgerEntries}
        onActivateBerry={handleActivateBerry}
        onShowArtifactOnGarden={handleShowOnGarden}
        onOpenArtifact={handleFocusArtifact}
      />

      {pendingApproval && (
        <ApprovalBanner
          approval={pendingApproval}
          onApprove={() => handleResolveApproval(true)}
          onDeny={() => handleResolveApproval(false)}
        />
      )}

      {ledgerOpen && (
        <IntelLedgerOverlay
          entries={ledgerEntries}
          onClose={() => setLedgerOpen(false)}
          onShowOnGarden={handleShowOnGarden}
        />
      )}

      {readerBerry && readerContent && (
        <ReaderPane
          berry={readerBerry}
          content={readerContent}
          onBack={() => setReaderBerryId(null)}
        />
      )}
    </main>
  );
};

/**
 * Approval gate banner (ADR-0003): the agent has hard-stopped before a
 * high-consequence Browser action and is BLOCKING until the user decides.
 * Floats above the Command Bar so it is visible on the Garden canvas; the
 * same gate is mirrored in the tab-view Command Bar.
 */
const ApprovalBanner: React.FC<{
  approval: { caption: string; reason: string };
  onApprove: () => void;
  onDeny: () => void;
}> = ({ approval, onApprove, onDeny }) => (
  <div className="pointer-events-auto absolute bottom-28 left-1/2 z-50 w-[min(560px,90vw)] -translate-x-1/2">
    <div className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.08] px-4 py-3 shadow-lift backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">
          Approval needed
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-ink">{approval.caption}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{approval.reason}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDeny}>
          Deny
        </Button>
        <Button variant="primary" size="sm" onClick={onApprove}>
          Approve
        </Button>
      </div>
    </div>
  </div>
);

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

interface GardenWorldProps {
  berries: Berry[];
  telemetry: TelemetryEvent[];
  gardenEchoes: FadedGardenEcho[];
  selectedBerryId: string | null;
  agentPosition: { x: number; y: number };
  showMapAgent: boolean;
  companionClip: ReturnType<typeof clipForAgentState>;
  companionBlocked: boolean;
  onSelectBerry: (id: string) => void;
  onOpenBerry: (berry: Berry) => void;
  onViewportChange: (viewport: ViewportTransform) => void;
  /** Camera command (stories 42–44): glide the viewport to center this world point. */
  cameraTarget: { x: number; y: number; nonce: number } | null;
}

const GardenWorld: React.FC<GardenWorldProps> = ({
  berries,
  telemetry,
  gardenEchoes,
  selectedBerryId,
  agentPosition,
  showMapAgent,
  companionClip,
  companionBlocked,
  onSelectBerry,
  onOpenBerry,
  onViewportChange,
  cameraTarget,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);

  const centerViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setPan({ x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });
    setZoom(1);
  }, []);

  useEffect(() => {
    centerViewport();
  }, [centerViewport]);

  /** True while the camera glides to a commanded target (CSS transition on). */
  const [isGliding, setIsGliding] = useState(false);

  // Camera command: center the target world point, gliding with the shared
  // HUD ease so the move reads as one motion, then hand control back.
  useEffect(() => {
    if (!cameraTarget) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    setIsGliding(true);
    setPan({
      x: viewport.clientWidth / 2 - cameraTarget.x * zoom,
      y: viewport.clientHeight / 2 - cameraTarget.y * zoom,
    });
    const t = setTimeout(() => setIsGliding(false), 450);
    return () => clearTimeout(t);
    // zoom intentionally omitted: re-centering on zoom change would fight the
    // cursor-anchored wheel zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget?.nonce]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const report = (): void => {
      onViewportChange({
        panX: pan.x,
        panY: pan.y,
        zoom,
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pan, zoom, onViewportChange]);

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ): void => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-berry-card]")) return;

    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ): void => {
    const start = panStartRef.current;
    if (!start) return;
    setPan({
      x: start.panX + (event.clientX - start.x),
      y: start.panY + (event.clientY - start.y),
    });
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (panStartRef.current) {
      panStartRef.current = null;
      setIsPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - pan.x) / zoom;
    const worldY = (cursorY - pan.y) / zoom;

    setZoom((currentZoom) => {
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, currentZoom - event.deltaY * 0.001),
      );
      setPan({
        x: cursorX - worldX * nextZoom,
        y: cursorY - worldY * nextZoom,
      });
      return nextZoom;
    });
  };

  return (
    <section
      ref={viewportRef}
      className={`garden-field absolute inset-0 touch-none select-none overflow-hidden ${
        isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onWheel={handleWheel}
    >
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: isGliding
            ? "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)"
            : undefined,
        }}
      >
        <div
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/40 bg-accent/15"
          style={{ left: 0, top: 0 }}
          aria-hidden
        />

        <TelemetryLayer berries={berries} telemetry={telemetry} />

        {gardenEchoes.map((echo) => (
          <div
            key={echo.id}
            className={`pointer-events-none absolute max-w-[220px] rounded-2xl border px-3 py-2 text-xs leading-relaxed backdrop-blur-sm ${
              echo.role === "user"
                ? "border-line/5 bg-surface-0/30 text-ink-faint/70"
                : "border-accent/10 bg-surface-1/30 text-accent/50"
            }`}
            style={{ left: echo.x, top: echo.y }}
          >
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider opacity-60">
              {echo.role === "user" ? "You" : "Main Agent"}
            </span>
            <span className="line-clamp-3">{echo.text}</span>
          </div>
        ))}

        {berries.map((berry) => (
          <BerryCard
            key={berry.id}
            berry={berry}
            selected={selectedBerryId === berry.id}
            onSelect={() => onSelectBerry(berry.id)}
            onOpen={() => onOpenBerry(berry)}
          />
        ))}

        {showMapAgent && (
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
            style={{ left: agentPosition.x, top: agentPosition.y }}
          >
            <Companion
              clip={companionClip}
              role="main"
              blocked={companionBlocked}
              size={150}
            />
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={centerViewport}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute bottom-36 z-20 gap-2 bg-surface-1/80 backdrop-blur"
        style={{ right: `calc(${GARDEN_RIGHT_HUD_WIDTH} + 1rem)` }}
        title="Center garden (origin)"
      >
        <Crosshair className="size-4 text-accent" />
        Center
      </Button>
    </section>
  );
};

interface BerryCardProps {
  berry: Berry;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

const isTabBerry = (berry: Berry): boolean =>
  berry.kind === "tab" || Boolean(berry.browserTabId);

const faviconFor = (url?: string): string | null => {
  if (!url) return null;
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return null;
  }
};

/**
 * Tab Berry — a screenshot-forward browser preview: a slim chrome bar
 * (favicon + title + active dot) over a thumbnail that fills the card. Reads
 * like a browser tab; recognition is visual, not metadata. Distinct from the
 * text-rich Artifact Berry card.
 */
/** A real screenshot data URL is long; an empty capture is ~22 chars. */
const hasValidShot = (src?: string): boolean =>
  Boolean(src && src.startsWith("data:image") && src.length > 100);

const TabBerryPreview: React.FC<{ berry: Berry }> = ({ berry }) => {
  const favicon = faviconFor(berry.url);
  const hostname = berry.subtitle || "";
  const showShot = hasValidShot(berry.screenshotDataUrl);
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line/10 bg-surface-0/70 px-2.5 py-1.5">
        {favicon ? (
          <img
            src={favicon}
            alt=""
            className="size-3.5 shrink-0 rounded-sm"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <Globe2 className="size-3.5 shrink-0 text-ink-faint" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink">
          {berry.title || hostname}
        </span>
        {berry.isActive && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-accent"
            title="Active tab"
          />
        )}
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-surface-0/40">
        {showShot ? (
          <img
            src={berry.screenshotDataUrl}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-2 text-center text-ink-faint">
            <Globe2 className="size-5 opacity-50" />
            <span className="text-[10px]">
              {hostname || "Loading preview…"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const ArtifactBerryContent: React.FC<{ berry: Berry }> = ({ berry }) => {
  const Icon = berryIcon[berry.kind];
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-accent/12 p-2 text-accent">
            <Icon className="size-4" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            {berry.kind}
          </span>
        </div>
        <Badge variant={berry.status === "complete" ? "active" : "neutral"}>
          {berry.status}
        </Badge>
      </div>
      <h3 className="line-clamp-2 font-display text-lg font-semibold text-ink">
        {berry.title}
      </h3>
      <p className="mt-1 line-clamp-1 text-sm text-ink-muted">
        {berry.subtitle}
      </p>
      {berry.screenshotDataUrl ? (
        <img
          src={berry.screenshotDataUrl}
          alt=""
          className="mt-4 h-14 w-full rounded-2xl border border-line/10 object-cover object-top"
        />
      ) : (
        <div className="mt-4 h-14 rounded-2xl border border-line/10 bg-surface-0/50" />
      )}
    </div>
  );
};

const BerryCard: React.FC<BerryCardProps> = ({
  berry,
  selected,
  onSelect,
  onOpen,
}) => {
  const tabBerry = isTabBerry(berry);

  const ringClass = selected
    ? "border-accent/60 ring-1 ring-accent/40"
    : berry.isActive
      ? "border-accent/40 ring-1 ring-accent/30"
      : "border-line/10 hover:border-accent/30";

  const className = `absolute overflow-hidden rounded-2xl border text-left shadow-panel backdrop-blur-md transition-all hover:-translate-y-0.5 ${
    tabBerry ? "bg-surface-1/80" : "bg-surface-1/70"
  } ${ringClass}`;

  const style = {
    left: berry.x,
    top: berry.y,
    width: berry.width,
    height: berry.height,
  };

  return (
    <button
      data-berry-card
      type="button"
      className={className}
      style={style}
      onClick={onSelect}
      onDoubleClick={onOpen}
      title={tabBerry ? "Double-click to enter this tab" : undefined}
    >
      {tabBerry ? (
        <TabBerryPreview berry={berry} />
      ) : (
        <ArtifactBerryContent berry={berry} />
      )}
    </button>
  );
};

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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
import { GardenHud, ViewportTransform } from "./components/GardenHud";
import { IntelLedgerOverlay } from "./components/IntelLedger";
import { ReaderPane } from "./components/ReaderPane";
import {
  Berry,
  type BerryKind,
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
  getMainAgentRoster,
  rosterHintForEmptyScope,
} from "./domain/gardenRoster";
import {
  cancelAgentSwitcher,
  closedAgentSwitcher,
  commitAgentSwitcher,
  cycleAgentSwitcher,
  selectedAgentId as selectedAgentSwitcherId,
} from "./domain/agentCycle";
import { getAgentDirectoryView } from "./domain/agentDirectory";
import { getRunControlsView } from "./domain/runControlsView";

/** Main-process state broadcast envelope (mirrors src/main/garden/channels.ts). */
interface GardenSnapshot {
  state: GardenState;
  pendingApproval: PendingApproval | null;
  /** Active Garden + directory (multi-garden, PRD 18-22). */
  gardenName: string;
  gardens: string[];
}
interface PendingApproval {
  id: string;
  agentId: string;
  commandId?: string;
  caption: string;
  reason: string;
}

const berryIcon: Record<
  BerryKind,
  React.ComponentType<{ className?: string }>
> = {
  tab: Globe2,
  sheet: FileSpreadsheet,
  xlsx: FileDown,
  lead: Sparkles,
  report: FileText,
};

export const GardenApp: React.FC = () => {
  const [state, setState] = useState<GardenState>(() =>
    createInitialGardenState(),
  );
  const [commandText, setCommandText] = useState("");
  const [selectedMainAgentId, setSelectedMainAgentId] = useState<string | null>(
    null,
  );
  const [rosterCycleHint, setRosterCycleHint] = useState<string | null>(null);
  const rosterSeededRef = useRef(false);
  const [recentAgentIds, setRecentAgentIds] = useState<string[]>([]);
  const [agentSwitcher, setAgentSwitcher] = useState(() =>
    closedAgentSwitcher(),
  );
  const [selectedBerryId, setSelectedBerryId] = useState<string | null>(null);
  const [readerBerryId, setReaderBerryId] = useState<string | null>(null);
  // Berries the user has opened. A completed/blocked Berry rings once for
  // attention, then drops its ring after it's been opened (see TelemetryLayer).
  const [seenBerryIds, setSeenBerryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const markBerrySeen = useCallback((berryId: string): void => {
    setSeenBerryIds((prev) =>
      prev.has(berryId) ? prev : new Set(prev).add(berryId),
    );
  }, []);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [latestAgentReply, setLatestAgentReply] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);
  // Camera (stories 42–44): commanded center target + follow-the-agent mode.
  const [cameraTarget, setCameraTarget] = useState<{
    x: number;
    y: number;
    nonce: number;
  } | null>(null);
  const [followAgent, setFollowAgent] = useState(false);
  /** Transient top-edge flash when the camera centers (not while following). */
  const [centeredFlash, setCenteredFlash] = useState(false);
  // Multi-garden directory (PRD 18-22), mirrored from the snapshot envelope.
  const [gardenName, setGardenName] = useState("Default");
  const [gardens, setGardens] = useState<string[]>([]);
  const [viewport, setViewport] = useState<ViewportTransform>({
    panX: 0,
    panY: 0,
    zoom: 1,
    width: 800,
    height: 600,
  });

  const mainAgentRoster = useMemo(
    () => getMainAgentRoster(state, "all"),
    [state],
  );
  const activeMainAgentRoster = useMemo(
    () => getMainAgentRoster(state, "in-progress"),
    [state],
  );
  const agentDirectory = useMemo(
    () => getAgentDirectoryView(state, selectedMainAgentId, pendingApproval),
    [state, selectedMainAgentId, pendingApproval],
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
  const runControlsView = useMemo(
    () => getRunControlsView(selectedWorkRun?.status),
    [selectedWorkRun?.status],
  );

  const runningWorkRun =
    selectedWorkRun?.status === "running" ? selectedWorkRun : undefined;
  const completedWorkRun =
    selectedWorkRun?.status === "complete" ? selectedWorkRun : undefined;

  const previewMainAgentId =
    selectedAgentSwitcherId(agentSwitcher) ?? selectedMainAgentId;
  const mainAgent = state.agents.find(
    (agent) => agent.id === previewMainAgentId,
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

  // Berries an agent is blocked at: the most recent telemetry Berry for any
  // agent currently in the "blocked" state. They get a warning ring until the
  // user attends to (opens) them.
  const blockedBerryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const agent of state.agents) {
      if (agent.state !== "blocked") continue;
      for (let i = state.telemetry.length - 1; i >= 0; i--) {
        const event = state.telemetry[i];
        if (event.agentId === agent.id && event.berryId) {
          ids.add(event.berryId);
          break;
        }
      }
    }
    return ids;
  }, [state.agents, state.telemetry]);

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

  const selectedAgentLabel = selectedCommand?.text.trim() || undefined;
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
        setGardenName(snapshot.gardenName);
        setGardens(snapshot.gardens);
        void seedRoster(snapshot as GardenSnapshot);
      })
      .catch(() => {});

    const unsub = window.gardenAPI?.onGardenState((snapshot) => {
      const snap = snapshot as GardenSnapshot;
      setState(snap.state);
      setPendingApproval(snap.pendingApproval);
      setGardenName(snap.gardenName);
      setGardens(snap.gardens);
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

  useEffect(() => {
    if (!selectedMainAgentId) return;
    setRecentAgentIds((ids) => [
      selectedMainAgentId,
      ...ids.filter((id) => id !== selectedMainAgentId),
    ]);
  }, [selectedMainAgentId]);

  const cycleAgentPreview = useCallback(
    (direction: 1 | -1): void => {
      const roster = getMainAgentRoster(state, "in-progress");
      if (roster.length === 0) {
        setRosterCycleHint(rosterHintForEmptyScope("in-progress"));
        return;
      }
      setRosterCycleHint(null);
      setAgentSwitcher((current) =>
        cycleAgentSwitcher(current, {
          recentAgentIds,
          activeAgentIds: roster.map((entry) => entry.agent.id),
          direction,
        }),
      );
    },
    [recentAgentIds, state],
  );

  const commitAgentPreview = useCallback((): void => {
    const committed = commitAgentSwitcher(agentSwitcher);
    setAgentSwitcher(committed.state);
    if (committed.target) setSelectedMainAgentId(committed.target);
  }, [agentSwitcher]);

  const cancelAgentPreview = useCallback((): void => {
    setAgentSwitcher(cancelAgentSwitcher);
  }, []);

  useEffect(() => {
    const unsubscribeCycle =
      window.gardenAPI?.onAgentSwitcherCycle(cycleAgentPreview);
    const unsubscribeCommit =
      window.gardenAPI?.onAgentSwitcherCommit(commitAgentPreview);
    const unsubscribeCancel =
      window.gardenAPI?.onAgentSwitcherCancel(cancelAgentPreview);
    return () => {
      unsubscribeCycle?.();
      unsubscribeCommit?.();
      unsubscribeCancel?.();
    };
  }, [cancelAgentPreview, commitAgentPreview, cycleAgentPreview]);

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

      // ⌘1–9 / Ctrl+1–9 — jump directly to the Nth Garden (peers, PRD 18-22).
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key >= "1" &&
        event.key <= "9"
      ) {
        const target = gardens[Number(event.key) - 1];
        if (target) {
          event.preventDefault();
          if (target !== gardenName) handleSwitchGarden(target);
          return;
        }
      }
      if (event.key === "Escape") {
        if (readerBerryId) {
          setReaderBerryId(null);
        } else if (ledgerOpen) {
          setLedgerOpen(false);
        } else if (agentSwitcher.open) {
          cancelAgentPreview();
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
          setCameraTarget((prev) => ({
            ...point,
            nonce: (prev?.nonce ?? 0) + 1,
          }));
        }
        if (event.key.toLowerCase() === "f") {
          setFollowAgent((on) => !on);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    cancelAgentPreview,
    agentSwitcher,
    ledgerOpen,
    readerBerryId,
    rosterCycleHint,
    state,
    selectedBerryId,
    gardens,
    gardenName,
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

  // Flash a top-edge "Centered" indicator on a one-shot center (C / button).
  // Follow mode bumps the nonce continuously, so it gets its own persistent
  // indicator instead — don't flash on every follow tick.
  useEffect(() => {
    if (!cameraTarget || followAgent) return;
    setCenteredFlash(true);
    const t = setTimeout(() => setCenteredFlash(false), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget?.nonce]);

  const handleSubmit = (): void => {
    const text = commandText.trim();
    if (!text) return;

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

  const handleApprovePlanForWorkRun = (workRunId: string): void => {
    void window.gardenAPI?.dispatch({
      type: "approve-work-run",
      workRunId,
    });
  };

  const handleResolveApproval = (approved: boolean): void => {
    if (!pendingApproval) return;
    void window.gardenAPI?.resolveApproval(pendingApproval.id, approved);
  };

  const handleOpenBerry = (berry: Berry): void => {
    // Opening a Berry attends to it — clear its attention ring.
    markBerrySeen(berry.id);
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
      markBerrySeen(berryId);
      setReaderBerryId(berryId);
    }
  };

  const handleMoveBerry = (berryId: string, x: number, y: number): void => {
    void window.gardenAPI?.dispatch({
      type: "move-berry",
      berryId,
      x,
      y,
    });
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

  const handleSwitchGarden = (name: string): void => {
    setSelectedBerryId(null);
    setReaderBerryId(null);
    void window.gardenAPI?.switchGarden?.(name);
  };

  // Promote a selected Scratch Berry into the first project garden (story 22).
  const promoteTarget =
    gardenName === "Scratch" && selectedBerryId
      ? gardens.find((name) => name !== "Scratch")
      : undefined;

  const handlePromoteSelected = (): void => {
    if (!selectedBerryId || !promoteTarget) return;
    void window.gardenAPI?.promoteBerry?.(selectedBerryId, promoteTarget);
    setSelectedBerryId(null);
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
    markBerrySeen(berryId);
    if (!berry.onMap) {
      void window.gardenAPI?.dispatch({ type: "show-berry", berryId });
    }
    setSelectedBerryId(berryId);
    if (berry.kind === "report") setReaderBerryId(berryId);
  };

  const latestTelemetry = state.telemetry.at(-1);
  // The companion clip IS the telemetry visualization: each agent state and
  // telemetry kind maps to a distinct humanoid animation (idle / walking /
  // looking / typing / thinking / cheer / blocked).
  const companionClip = clipForAgentState(
    mainAgent?.state,
    latestTelemetry?.kind,
  );

  return (
    <main className="relative h-full w-full overflow-hidden bg-garden-base text-ink">
      {/* Camera mode indicator — top edge, center. Follow is persistent (and
          explains the agent-tracking drift); a one-shot center flashes briefly. */}
      {(followAgent || centeredFlash) && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] shadow-lift backdrop-blur-sm ${
              followAgent
                ? "animate-pulse border-accent/50 bg-accent/15 text-accent"
                : "border-line/20 bg-surface-0/80 text-ink-muted"
            }`}
          >
            <Crosshair className="size-3.5" />
            {followAgent ? "Following agent — F to stop" : "Centered"}
          </span>
        </div>
      )}

      <GardenWorld
        berries={visibleBerries}
        telemetry={state.telemetry}
        selectedBerryId={selectedBerryId}
        seenBerryIds={seenBerryIds}
        blockedBerryIds={blockedBerryIds}
        agentPosition={agentPosition}
        cameraTarget={cameraTarget}
        showMapAgent={Boolean(runningWorkRun)}
        companionClip={companionClip}
        companionBlocked={mainAgent?.state === "blocked"}
        onSelectBerry={handleSelectBerry}
        onOpenBerry={handleOpenBerry}
        onMoveBerry={handleMoveBerry}
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
        runControls={runControlsView}
        selectedWorkRunPlan={selectedWorkRun?.plan}
        selectedWorkRunPlanStatus={selectedWorkRun?.planStatus}
        onAdvanceWorkRun={runningWorkRun ? handleAdvanceWorkRun : undefined}
        onCompleteWorkRun={
          runningWorkRun || completedWorkRun ? handleCompleteWorkRun : undefined
        }
        onPauseWorkRun={runningWorkRun ? handlePauseWorkRun : undefined}
        onRetryWorkRun={
          selectedWorkRun?.status === "blocked" ||
          selectedWorkRun?.status === "interrupted"
            ? handleRetryWorkRun
            : undefined
        }
        agentDirectory={agentDirectory}
        mainAgentRoster={mainAgentRoster}
        activeMainAgentRoster={activeMainAgentRoster}
        recentAgentIds={recentAgentIds}
        selectedMainAgentId={previewMainAgentId}
        onSelectMainAgent={handleSelectMainAgent}
        onNewCommand={handleNewCommand}
        onMarkCommandDone={handleMarkCommandDone}
        onReopenCommand={handleReopenCommand}
        onApprovePlanForWorkRun={handleApprovePlanForWorkRun}
        onResolveApproval={handleResolveApproval}
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
        gardenName={gardenName}
        gardens={gardens}
        onSwitchGarden={handleSwitchGarden}
        promoteTarget={promoteTarget}
        onPromoteSelected={promoteTarget ? handlePromoteSelected : undefined}
        onShowArtifactOnGarden={handleShowOnGarden}
        onOpenArtifact={handleFocusArtifact}
      />
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

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

interface GardenWorldProps {
  berries: Berry[];
  telemetry: TelemetryEvent[];
  selectedBerryId: string | null;
  /** Berries the user has opened — their attention ring is cleared. */
  seenBerryIds: Set<string>;
  /** Berries an agent is currently blocked at — they get a warning ring. */
  blockedBerryIds: Set<string>;
  agentPosition: { x: number; y: number };
  showMapAgent: boolean;
  companionClip: ReturnType<typeof clipForAgentState>;
  companionBlocked: boolean;
  onSelectBerry: (id: string) => void;
  onOpenBerry: (berry: Berry) => void;
  onMoveBerry: (berryId: string, x: number, y: number) => void;
  onViewportChange: (viewport: ViewportTransform) => void;
  /** Camera command (stories 42–44): glide the viewport to center this world point. */
  cameraTarget: { x: number; y: number; nonce: number } | null;
}

const GardenWorld: React.FC<GardenWorldProps> = ({
  berries,
  telemetry,
  selectedBerryId,
  seenBerryIds,
  blockedBerryIds,
  agentPosition,
  showMapAgent,
  companionClip,
  companionBlocked,
  onSelectBerry,
  onOpenBerry,
  onMoveBerry,
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
  const berryDragRef = useRef<{
    berryId: string;
    x: number;
    y: number;
    berryX: number;
    berryY: number;
    currentX: number;
    currentY: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);
  const suppressBerryClickRef = useRef<string | null>(null);
  const [draggedBerry, setDraggedBerry] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

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
    const berryCard = target.closest<HTMLElement>("[data-berry-card-id]");

    if (berryCard?.dataset.berryCardId) {
      const berry = berries.find(
        (candidate) => candidate.id === berryCard.dataset.berryCardId,
      );
      if (!berry) return;

      onSelectBerry(berry.id);
      berryDragRef.current = {
        berryId: berry.id,
        x: event.clientX,
        y: event.clientY,
        berryX: berry.x,
        berryY: berry.y,
        currentX: berry.x,
        currentY: berry.y,
        pointerId: event.pointerId,
        moved: false,
      };
      suppressBerryClickRef.current = null;
      setDraggedBerry({ id: berry.id, x: berry.x, y: berry.y });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

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
    const berryDrag = berryDragRef.current;
    if (berryDrag) {
      const dx = (event.clientX - berryDrag.x) / zoom;
      const dy = (event.clientY - berryDrag.y) / zoom;
      const nextX = berryDrag.berryX + dx;
      const nextY = berryDrag.berryY + dy;
      const moved =
        Math.hypot(event.clientX - berryDrag.x, event.clientY - berryDrag.y) >
        3;
      berryDragRef.current = {
        ...berryDrag,
        currentX: nextX,
        currentY: nextY,
        moved: berryDrag.moved || moved,
      };
      setDraggedBerry({ id: berryDrag.berryId, x: nextX, y: nextY });
      return;
    }

    const start = panStartRef.current;
    if (!start) return;
    setPan({
      x: start.panX + (event.clientX - start.x),
      y: start.panY + (event.clientY - start.y),
    });
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>): void => {
    const berryDrag = berryDragRef.current;
    if (berryDrag) {
      berryDragRef.current = null;
      setDraggedBerry(null);
      if (berryDrag.moved) {
        suppressBerryClickRef.current = berryDrag.berryId;
        onMoveBerry(berryDrag.berryId, berryDrag.currentX, berryDrag.currentY);
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

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
        <TelemetryLayer
          berries={berries}
          telemetry={telemetry}
          seenBerryIds={seenBerryIds}
          blockedBerryIds={blockedBerryIds}
        />

        {berries.map((berry) => (
          <BerryCard
            key={berry.id}
            berry={berry}
            selected={selectedBerryId === berry.id}
            dragging={draggedBerry?.id === berry.id}
            dragPosition={
              draggedBerry?.id === berry.id
                ? { x: draggedBerry.x, y: draggedBerry.y }
                : null
            }
            onSelect={() => {
              if (suppressBerryClickRef.current === berry.id) {
                suppressBerryClickRef.current = null;
                return;
              }
              onSelectBerry(berry.id);
            }}
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
        className="absolute bottom-28 right-6 z-20 gap-2 bg-surface-1/80 backdrop-blur"
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
  dragging: boolean;
  dragPosition: { x: number; y: number } | null;
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
  // Fall back to a generic icon for any kind the map doesn't cover, so an
  // unexpected Berry kind from main never renders an undefined element (which
  // would crash the whole Garden tree).
  const Icon = berryIcon[berry.kind] ?? FileText;
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
        {/* No status badge here — the Berry's live status is conveyed by its
            telemetry ring (see TelemetryLayer), so the card stays uncluttered. */}
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
  dragging,
  dragPosition,
  onSelect,
  onOpen,
}) => {
  const tabBerry = isTabBerry(berry);

  const ringClass = selected
    ? "border-accent/60 ring-1 ring-accent/40"
    : berry.isActive
      ? "border-accent/40 ring-1 ring-accent/30"
      : "border-line/10 hover:border-accent/30";

  const className = `absolute overflow-hidden rounded-2xl border text-left shadow-panel backdrop-blur-md ${
    dragging
      ? "cursor-grabbing"
      : "cursor-grab transition-all hover:-translate-y-0.5"
  } ${tabBerry ? "bg-surface-1/80" : "bg-surface-1/70"} ${ringClass}`;

  const style = {
    left: dragPosition?.x ?? berry.x,
    top: dragPosition?.y ?? berry.y,
    width: berry.width,
    height: berry.height,
    zIndex: dragging || selected ? 15 : undefined,
  };

  return (
    <button
      data-berry-card-id={berry.id}
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

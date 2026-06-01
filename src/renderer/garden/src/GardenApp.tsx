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
import {
  fadeMessageOntoGarden,
  FadedGardenEcho,
  GARDEN_RIGHT_HUD_WIDTH,
  GardenHud,
  replyForCommand,
  ViewportTransform,
} from "./components/GardenHud";
import { IntelLedgerOverlay } from "./components/IntelLedger";
import { ReaderPane } from "./components/ReaderPane";
import {
  advanceWorkRun,
  approveWorkRun,
  AUTO_ADVANCE_MS,
  Berry,
  completeWorkRun,
  createInitialGardenState,
  GardenState,
  getLedgerEntries,
  getReaderContent,
  getVisibleBerries,
  hasActiveWorkRun,
  showBerryOnGarden,
  submitCommand,
} from "./domain/gardenDomain";
import {
  cycleMainAgentId,
  getMainAgentRoster,
  loadMainAgentCycleScope,
  markCommandCompleted,
  reopenCommand,
  rosterHintForEmptyScope,
  saveMainAgentCycleScope,
  spawnNewCommand,
  type MainAgentCycleScope,
} from "./domain/gardenRoster";

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
    createInitialGardenState()
  );
  const [commandText, setCommandText] = useState(DEMO_COMMAND);
  const [selectedMainAgentId, setSelectedMainAgentId] = useState<string | null>(
    null
  );
  const [mainAgentCycleScope, setMainAgentCycleScope] =
    useState<MainAgentCycleScope>(loadMainAgentCycleScope);
  const [rosterCycleHint, setRosterCycleHint] = useState<string | null>(null);
  const rosterSeededRef = useRef(false);
  const [selectedBerryId, setSelectedBerryId] = useState<string | null>(null);
  const [readerBerryId, setReaderBerryId] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [latestAgentReply, setLatestAgentReply] = useState<string | null>(null);
  const [gardenEchoes, setGardenEchoes] = useState<FadedGardenEcho[]>([]);
  const [viewport, setViewport] = useState<ViewportTransform>({
    panX: 0,
    panY: 0,
    zoom: 1,
    width: 800,
    height: 600,
  });

  const mainAgentRoster = useMemo(
    () => getMainAgentRoster(state, mainAgentCycleScope),
    [state, mainAgentCycleScope]
  );

  const selectedCommand = useMemo(
    () =>
      state.commands.find(
        (command) => command.mainAgentId === selectedMainAgentId
      ),
    [state.commands, selectedMainAgentId]
  );

  const selectedWorkRun = useMemo(
    () =>
      selectedCommand?.workRunId
        ? state.workRuns.find((run) => run.id === selectedCommand.workRunId)
        : undefined,
    [state.workRuns, selectedCommand?.workRunId]
  );

  const plannedWorkRun =
    selectedWorkRun?.status === "planning" ? selectedWorkRun : undefined;
  const runningWorkRun =
    selectedWorkRun?.status === "running" ? selectedWorkRun : undefined;
  const completedWorkRun =
    selectedWorkRun?.status === "complete" ? selectedWorkRun : undefined;

  const mainAgent = state.agents.find(
    (agent) => agent.id === selectedMainAgentId
  );
  const visibleBerries = getVisibleBerries(state);
  const ledgerEntries = getLedgerEntries(state);
  const readerBerry = state.berries.find((berry) => berry.id === readerBerryId);
  const readerContent = readerBerry ? getReaderContent(readerBerry) : null;

  useEffect(() => {
    if (rosterSeededRef.current) return;
    setState((current) => {
      if (current.commands.length > 0) {
        rosterSeededRef.current = true;
        return current;
      }
      rosterSeededRef.current = true;
      const seeded = spawnNewCommand(current);
      setSelectedMainAgentId(seeded.mainAgentId);
      return seeded.state;
    });
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
      if (event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }

      event.preventDefault();
      const roster = getMainAgentRoster(state, mainAgentCycleScope);
      if (roster.length === 0) {
        setRosterCycleHint(rosterHintForEmptyScope(mainAgentCycleScope));
        return;
      }
      setRosterCycleHint(null);
      setSelectedMainAgentId(
        cycleMainAgentId(roster, selectedMainAgentId)
      );
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
  ]);

  useEffect(() => {
    if (!runningWorkRun) return;

    const timer = window.setInterval(() => {
      setState((current) => {
        const run = current.workRuns.find(
          (candidate) => candidate.id === runningWorkRun.id
        );
        if (!run || run.status !== "running") return current;
        return advanceWorkRun(current, run.id);
      });
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [runningWorkRun?.id, runningWorkRun?.status, runningWorkRun?.step]);

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
      fadeMessageOntoGarden([...echoes, ...superseded], echoes.length)
    );

    setState((current) => {
      const result = submitCommand(current, text, selectedMainAgentId);
      if (result.hint) {
        setRosterCycleHint(result.hint);
      } else {
        setRosterCycleHint(null);
      }
      setSelectedMainAgentId(result.mainAgentId);
      const command = result.state.commands.find(
        (candidate) => candidate.mainAgentId === result.mainAgentId
      );
      if (command) {
        const agent = result.state.agents.find(
          (candidate) => candidate.id === command.mainAgentId
        );
        setLatestAgentReply(
          replyForCommand(command.route, agent?.currentLabel)
        );
      }
      return result.state;
    });
    setCommandText("");
  };

  const handleNewCommand = (): void => {
    setRosterCycleHint(null);
    setState((current) => {
      const spawned = spawnNewCommand(current);
      setSelectedMainAgentId(spawned.mainAgentId);
      return spawned.state;
    });
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
    const agent = state.agents.find((candidate) => candidate.id === mainAgentId);
    if (agent && agent.state !== "idle") {
      setLatestAgentReply(agent.currentLabel);
    }
  };

  const handleMarkCommandDone = (commandId: string): void => {
    setState((current) => markCommandCompleted(current, commandId));
  };

  const handleReopenCommand = (commandId: string): void => {
    setState((current) => reopenCommand(current, commandId));
  };

  const handleApprovePlan = (): void => {
    if (!plannedWorkRun) return;
    setState((current) => approveWorkRun(current, plannedWorkRun.id));
  };

  const handleOpenBerry = (berry: Berry): void => {
    if (berry.kind === "tab" || berry.browserTabId) return;

    if (berry.kind === "report") {
      setReaderBerryId(berry.id);
      return;
    }

    if (!berry.url) return;
    void window.gardenAPI?.openUrl(berry.url);
  };

  const handleSelectBerry = (berryId: string): void => {
    const berry = state.berries.find((candidate) => candidate.id === berryId);
    if (!berry || berry.kind === "tab" || berry.browserTabId) return;

    setSelectedBerryId(berryId);
    if (berry.kind === "report") {
      setReaderBerryId(berryId);
    }
  };

  const handleAdvanceWorkRun = (): void => {
    if (!runningWorkRun) return;
    setState((current) => advanceWorkRun(current, runningWorkRun.id));
  };

  const handleCompleteWorkRun = (): void => {
    const target = runningWorkRun ?? completedWorkRun;
    if (!target) return;
    setState((current) => completeWorkRun(current, target.id));
  };

  const handleShowOnGarden = (berryId: string): void => {
    setState((current) => showBerryOnGarden(current, berryId));
    setSelectedBerryId(berryId);
    setLedgerOpen(false);
  };

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#031633] text-slate-100">
      <GardenWorld
        berries={visibleBerries}
        gardenEchoes={gardenEchoes}
        selectedBerryId={selectedBerryId}
        agentPosition={agentPosition}
        showMapAgent={Boolean(runningWorkRun)}
        onSelectBerry={handleSelectBerry}
        onOpenBerry={handleOpenBerry}
        onViewportChange={setViewport}
      />

      <GardenHud
        berries={visibleBerries}
        viewport={viewport}
        agent={mainAgent}
        latestAgentReply={latestAgentReply}
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
  gardenEchoes: FadedGardenEcho[];
  selectedBerryId: string | null;
  agentPosition: { x: number; y: number };
  showMapAgent: boolean;
  onSelectBerry: (id: string) => void;
  onOpenBerry: (berry: Berry) => void;
  onViewportChange: (viewport: ViewportTransform) => void;
}

const GardenWorld: React.FC<GardenWorldProps> = ({
  berries,
  gardenEchoes,
  selectedBerryId,
  agentPosition,
  showMapAgent,
  onSelectBerry,
  onOpenBerry,
  onViewportChange,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null
  );
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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
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

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
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
        Math.max(MIN_ZOOM, currentZoom - event.deltaY * 0.001)
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
      className={`absolute inset-0 touch-none select-none overflow-hidden bg-[#031633] ${
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
        }}
      >
        <div
          className="pointer-events-none absolute bg-[#041a38]/40"
          style={{
            left: -50000,
            top: -50000,
            width: 100000,
            height: 100000,
          }}
        />
        <div
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-200/40 bg-blue-200/20"
          style={{ left: 0, top: 0 }}
          aria-hidden
        />

        <svg className="pointer-events-none absolute left-0 top-0 h-[2000px] w-[2000px] -translate-x-1/2 -translate-y-1/2">
          <path
            className="data-flow"
            d="M 390 285 C 520 340, 670 300, 820 265"
            fill="none"
            stroke="rgba(125,211,252,0.58)"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M 690 320 C 760 410, 830 435, 880 505"
            fill="none"
            stroke="rgba(191,219,254,0.25)"
            strokeDasharray="8 12"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>

        {gardenEchoes.map((echo) => (
          <div
            key={echo.id}
            className={`pointer-events-none absolute max-w-[220px] rounded-2xl border px-3 py-2 text-xs leading-relaxed backdrop-blur-sm ${
              echo.role === "user"
                ? "border-white/5 bg-slate-950/20 text-slate-400/70"
                : "border-blue-200/10 bg-blue-950/25 text-blue-100/50"
            }`}
            style={{ left: echo.x, top: echo.y }}
          >
            <span className="mb-1 block text-[10px] uppercase tracking-wider opacity-60">
              {echo.role === "user" ? "You" : "Blue"}
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
            className="absolute z-10 transition-all duration-700 ease-out"
            style={{ left: agentPosition.x, top: agentPosition.y }}
          >
            <div className="agent-bob relative">
              <div className="pulse-ring relative flex size-16 items-center justify-center rounded-full bg-blue-200/15 shadow-[0_0_32px_rgba(96,165,250,0.55)]">
                <div className="relative flex h-12 w-9 flex-col items-center">
                  <div className="h-5 w-5 rounded-full bg-blue-100 shadow-[0_0_18px_rgba(191,219,254,0.9)]" />
                  <div className="mt-1 h-6 w-8 rounded-b-2xl rounded-t-lg bg-blue-300" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={centerViewport}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute bottom-36 z-20 flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/75 px-3 py-2 text-sm text-slate-100 shadow-lg backdrop-blur hover:bg-slate-900/90"
        style={{ right: `calc(${GARDEN_RIGHT_HUD_WIDTH} + 1rem)` }}
        title="Center garden (origin)"
      >
        <Crosshair className="size-4 text-blue-200" />
        Center
      </button>
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

const BerryCard: React.FC<BerryCardProps> = ({
  berry,
  selected,
  onSelect,
  onOpen,
}) => {
  const Icon = berryIcon[berry.kind];
  const tabBerry = isTabBerry(berry);

  const className = `absolute rounded-3xl border p-4 text-left shadow-2xl ${
    tabBerry
      ? "pointer-events-none cursor-default border-white/10 bg-white/5 opacity-90"
      : `transition-all hover:-translate-y-1 ${
          selected
            ? "border-blue-200 bg-blue-200/18"
            : "border-white/10 bg-white/9 hover:border-blue-200/40"
        }`
  }`;

  const style = {
    left: berry.x,
    top: berry.y,
    width: berry.width,
    height: berry.height,
  };

  const content = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-blue-200/15 p-2 text-blue-100">
            <Icon className="size-4" />
          </div>
          <span className="text-xs uppercase tracking-[0.18em] text-blue-100/70">
            {berry.kind}
          </span>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-200">
          {berry.status}
        </span>
      </div>
      <h3 className="line-clamp-2 text-lg font-semibold text-white">
        {berry.title}
      </h3>
      <p className="mt-1 text-sm text-slate-300">{berry.subtitle}</p>
      {berry.screenshotDataUrl ? (
        <img
          src={berry.screenshotDataUrl}
          alt=""
          className="mt-4 h-14 w-full rounded-2xl border border-white/10 object-cover object-top"
        />
      ) : (
        <div className="mt-4 h-14 rounded-2xl border border-white/10 bg-blue-950/40" />
      )}
    </>
  );

  if (tabBerry) {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }

  return (
    <button
      data-berry-card
      type="button"
      className={className}
      style={style}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      {content}
    </button>
  );
};


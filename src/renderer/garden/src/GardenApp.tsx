import React, { useMemo, useState } from "react";
import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Globe2,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import {
  approveWorkRun,
  Berry,
  createInitialGardenState,
  GardenState,
  submitCommand,
} from "./domain/gardenDomain";

const DEMO_COMMAND =
  "Look at Strawberry's product and sales prospecting pages. Infer who they sell to. Then search the web for 10 companies that might buy Blueberry. Write them to Google Sheets with evidence and outreach angles. Keep an XLSX backup.";

const berryIcon = {
  tab: Globe2,
  sheet: FileSpreadsheet,
  xlsx: FileDown,
  lead: Sparkles,
  "work-run": Archive,
};

export const GardenApp: React.FC = () => {
  const [state, setState] = useState<GardenState>(() =>
    createInitialGardenState()
  );
  const [commandText, setCommandText] = useState(DEMO_COMMAND);
  const [selectedBerryId, setSelectedBerryId] = useState<string | null>(null);
  const plannedWorkRun = state.workRuns.find((run) => run.status === "planning");
  const runningWorkRun = state.workRuns.find((run) => run.status === "running");
  const mainAgent = state.agents[0];
  const selectedBerry = state.berries.find((berry) => berry.id === selectedBerryId);

  const agentPosition = useMemo(() => {
    if (!state.berries.length) return { x: 440, y: 310 };
    const target =
      state.berries.find((berry) => berry.status === "reading") ??
      state.berries[0];
    return {
      x: target.x + target.width - 22,
      y: target.y + target.height + 22,
    };
  }, [state.berries]);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!commandText.trim()) return;
    setState((current) => submitCommand(current, commandText.trim()));
  };

  const handleApprovePlan = (): void => {
    if (!plannedWorkRun) return;
    setState((current) => approveWorkRun(current, plannedWorkRun.id));
  };

  const handleOpenBerry = (berry: Berry): void => {
    if (berry.kind !== "tab" || !berry.url) return;
    window.gardenAPI?.openUrl(berry.url);
  };

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#031633] text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(69,130,255,0.25),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(54,211,153,0.12),transparent_24%),linear-gradient(135deg,#031633_0%,#061b3d_45%,#020817_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:56px_56px]" />

      <section className="relative flex h-full">
        <aside className="z-10 hidden w-16 border-r border-white/10 bg-slate-950/35 p-2 backdrop-blur md:block">
          <div className="mb-4 flex h-10 items-center justify-center rounded-2xl bg-blue-400/15 text-lg">
            B
          </div>
          <div className="space-y-2">
            {state.berries
              .filter((berry) => berry.kind === "tab")
              .map((berry) => (
                <button
                  key={berry.id}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10"
                  title={berry.title}
                  onClick={() => setSelectedBerryId(berry.id)}
                >
                  {berry.title.slice(0, 1)}
                </button>
              ))}
          </div>
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <header className="z-10 flex items-center justify-between px-6 pt-5">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-blue-200/70">
                Garden
              </p>
              <h1 className="text-2xl font-semibold">Blueberry Sales Leads</h1>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-blue-100">
              Work Garden
            </div>
          </header>

          <GardenWorld
            berries={state.berries}
            selectedBerryId={selectedBerryId}
            agentPosition={agentPosition}
            agentLabel={mainAgent?.currentLabel ?? "Ready for browser work"}
            onSelectBerry={setSelectedBerryId}
            onOpenBerry={handleOpenBerry}
          />

          {plannedWorkRun && (
            <PlanCard
              workRun={plannedWorkRun}
              onApprove={handleApprovePlan}
            />
          )}

          {!state.commands.length && <EmptyGarden />}

          <footer className="z-20 border-t border-white/10 bg-slate-950/60 px-5 py-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-4 text-sm text-slate-300">
              <div className="flex min-w-0 items-center gap-3">
                <Bot className="size-4 text-blue-200" />
                <span className="truncate">
                  {mainAgent?.currentLabel ??
                    "Blue is idle. Ask for quick help or delegate visible work."}
                </span>
              </div>
              <div className="hidden items-center gap-3 text-xs text-slate-400 md:flex">
                {runningWorkRun ? (
                  <>
                    <span>Visible telemetry on</span>
                    <span>{state.berries.length} Berries</span>
                    <span>{state.telemetry.length} trace events</span>
                  </>
                ) : (
                  <span>Simple commands stay compact. Work commands grow here.</span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                value={commandText}
                onChange={(event) => setCommandText(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-blue-300/60"
                placeholder="Ask, command, or delegate browser work..."
              />
              <button
                type="submit"
                className="flex items-center gap-2 rounded-2xl bg-blue-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-blue-200"
              >
                <Play className="size-4" />
                Run
              </button>
            </form>
          </footer>
        </div>

        {selectedBerry && (
          <aside className="z-20 hidden w-80 border-l border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl lg:block">
            <p className="mb-2 text-xs uppercase tracking-[0.28em] text-blue-200/70">
              Selected Berry
            </p>
            <h2 className="mb-1 text-xl font-semibold">{selectedBerry.title}</h2>
            <p className="mb-5 text-sm text-slate-400">{selectedBerry.subtitle}</p>
            <div className="space-y-3 text-sm">
              <TraceRow label="Kind" value={selectedBerry.kind} />
              <TraceRow label="Status" value={selectedBerry.status} />
              <TraceRow
                label="Local trace"
                value={
                  state.telemetry.find(
                    (event) => event.berryId === selectedBerry.id
                  )?.label ?? "No detailed events yet"
                }
              />
            </div>
          </aside>
        )}
      </section>
    </main>
  );
};

interface GardenWorldProps {
  berries: Berry[];
  selectedBerryId: string | null;
  agentPosition: { x: number; y: number };
  agentLabel: string;
  onSelectBerry: (id: string) => void;
  onOpenBerry: (berry: Berry) => void;
}

const GardenWorld: React.FC<GardenWorldProps> = ({
  berries,
  selectedBerryId,
  agentPosition,
  agentLabel,
  onSelectBerry,
  onOpenBerry,
}) => (
  <section className="relative min-h-0 flex-1">
    <svg className="pointer-events-none absolute inset-0 h-full w-full">
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

    {berries.map((berry) => (
      <BerryCard
        key={berry.id}
        berry={berry}
        selected={selectedBerryId === berry.id}
        onSelect={() => onSelectBerry(berry.id)}
        onOpen={() => onOpenBerry(berry)}
      />
    ))}

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
        <div className="absolute left-12 top-0 w-56 rounded-2xl border border-blue-200/20 bg-slate-950/80 px-3 py-2 text-xs text-blue-50 shadow-xl backdrop-blur">
          {agentLabel}
        </div>
      </div>
    </div>

    <div className="absolute right-5 top-5 h-28 w-40 rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span>Overview</span>
        <span className="text-blue-200">{berries.length || 1} objs</span>
      </div>
      <div className="relative h-16 rounded-xl bg-blue-950/70">
        {berries.map((berry) => (
          <span
            key={berry.id}
            className="absolute size-2 rounded-full bg-blue-200"
            style={{
              left: `${Math.min(92, berry.x / 12)}%`,
              top: `${Math.min(86, berry.y / 7)}%`,
            }}
          />
        ))}
      </div>
    </div>
  </section>
);

interface BerryCardProps {
  berry: Berry;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

const BerryCard: React.FC<BerryCardProps> = ({
  berry,
  selected,
  onSelect,
  onOpen,
}) => {
  const Icon = berryIcon[berry.kind];

  return (
    <button
      className={`absolute rounded-3xl border p-4 text-left shadow-2xl transition-all hover:-translate-y-1 ${
        selected
          ? "border-blue-200 bg-blue-200/18"
          : "border-white/10 bg-white/9 hover:border-blue-200/40"
      }`}
      style={{
        left: berry.x,
        top: berry.y,
        width: berry.width,
        height: berry.height,
      }}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
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
      <div className="mt-4 h-14 rounded-2xl border border-white/10 bg-gradient-to-br from-blue-200/15 to-slate-950/30" />
    </button>
  );
};

const EmptyGarden: React.FC = () => (
  <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-xl -translate-x-1/2 -translate-y-1/2 text-center">
    <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-blue-200/10 shadow-[0_0_60px_rgba(96,165,250,0.28)]">
      <Bot className="size-10 text-blue-100" />
    </div>
    <h2 className="mb-3 text-3xl font-semibold">Visible browser work starts here</h2>
    <p className="mb-6 text-sm leading-6 text-slate-300">
      Ask a quick question, or delegate browser work that becomes agents,
      Berries, and output tools in the Garden.
    </p>
    <div className="flex flex-wrap justify-center gap-2 text-xs text-blue-100">
      {[
        "Find sales leads",
        "Extract data from websites",
        "Compare competitors",
        "Draft outreach",
        "Monitor product updates",
      ].map((suggestion) => (
        <span
          key={suggestion}
          className="rounded-full border border-white/10 bg-white/10 px-3 py-2"
        >
          {suggestion}
        </span>
      ))}
    </div>
  </div>
);

interface PlanCardProps {
  workRun: GardenState["workRuns"][number];
  onApprove: () => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ workRun, onApprove }) => (
  <section className="absolute right-7 top-24 z-30 w-[430px] rounded-3xl border border-white/10 bg-slate-950/85 p-5 shadow-2xl backdrop-blur-xl">
    <p className="mb-2 text-xs uppercase tracking-[0.28em] text-blue-200/70">
      Proposed Work Run
    </p>
    <h2 className="mb-3 text-xl font-semibold">{workRun.title}</h2>
    <p className="mb-4 text-sm leading-6 text-slate-300">
      {workRun.plan.summary}
    </p>
    <PlanSection title="Sources" items={workRun.plan.sources} />
    <PlanSection title="Output columns" items={workRun.plan.outputColumns} />
    <PlanSection
      title="Approval checkpoints"
      items={workRun.plan.approvalCheckpoints}
    />
    <button
      onClick={onApprove}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-blue-200"
    >
      <CheckCircle2 className="size-4" />
      Approve and visualize work
    </button>
  </section>
);

const PlanSection: React.FC<{ title: string; items: string[] }> = ({
  title,
  items,
}) => (
  <details className="group border-t border-white/10 py-3">
    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-100">
      {title}
      <ChevronDown className="size-4 transition group-open:rotate-180" />
    </summary>
    <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <Search className="mt-0.5 size-3 shrink-0 text-blue-200" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </details>
);

const TraceRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
      {label}
    </div>
    <div className="mt-1 text-slate-100">{value}</div>
  </div>
);

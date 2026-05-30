export type CommandRoute = "quick" | "work-run";
export type CommandStatus = "complete" | "planning" | "running" | "blocked";
export type WorkRunStatus = "planning" | "running" | "complete" | "blocked";

export interface Agent {
  id: string;
  name: string;
  role: "main";
  state: "idle" | "planning" | "moving" | "acting" | "blocked" | "complete";
  currentLabel: string;
}

export interface Command {
  id: string;
  text: string;
  route: CommandRoute;
  status: CommandStatus;
  mainAgentId: string;
  workRunId?: string;
}

export interface WorkRunPlan {
  summary: string;
  sources: string[];
  qualificationCriteria: string[];
  outputColumns: string[];
  destination: {
    primary: "Google Sheets";
    backup: "XLSX";
  };
  approvalCheckpoints: string[];
}

export interface WorkRun {
  id: string;
  title: string;
  commandId: string;
  mainAgentId: string;
  status: WorkRunStatus;
  plan: WorkRunPlan;
  step: number;
}

export type BerryKind =
  | "tab"
  | "sheet"
  | "xlsx"
  | "lead"
  | "report"
  | "work-run";

export type BerryStatus =
  | "idle"
  | "reading"
  | "extracting"
  | "writing"
  | "complete";

export interface Berry {
  id: string;
  kind: BerryKind;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: BerryStatus;
  url?: string;
  workRunId?: string;
  onMap: boolean;
  filePath?: string;
  browserTabId?: string;
  screenshotDataUrl?: string;
}

export interface TabBerrySnapshot {
  browserTabId: string;
  title: string;
  url: string;
  screenshotDataUrl?: string;
}

export type LedgerEntry = Berry & {
  workRunTitle: string;
};

export type TelemetryKind =
  | "intent"
  | "action"
  | "observation"
  | "decision"
  | "tool_call"
  | "write"
  | "complete";

export interface TelemetryEvent {
  id: string;
  workRunId: string;
  agentId: string;
  berryId?: string;
  fromBerryId?: string;
  toBerryId?: string;
  kind: TelemetryKind;
  label: string;
  icon: string;
}

export interface GardenState {
  commands: Command[];
  agents: Agent[];
  workRuns: WorkRun[];
  berries: Berry[];
  telemetry: TelemetryEvent[];
}

const DEMO_OUTPUT_COLUMNS = [
  "Company",
  "Website",
  "Segment",
  "Why Blueberry fits",
  "Evidence",
  "Evidence URL",
  "Suggested buyer",
  "Outreach angle",
  "Status",
];

const SOURCE_BERRY_IDS = [
  "berry-strawberry-home",
  "berry-strawberry-sales",
  "berry-open-web-search",
];

export const WORK_RUN_STEP_COUNT = 3;
export const AUTO_ADVANCE_MS = 2800;

const WORK_RUN_STEPS = [
  {
    agentLabel: "Reading Strawberry sales prospecting page",
    telemetry: {
      kind: "action" as const,
      label: "Read Strawberry sales prospecting page",
      icon: "read",
      berryId: "berry-strawberry-sales",
    },
  },
  {
    agentLabel: "Searching the open web for likely buyers",
    telemetry: {
      kind: "action" as const,
      label: "Search for browser-heavy sales teams",
      icon: "search",
      berryId: "berry-open-web-search",
    },
  },
  {
    agentLabel: "Writing qualified rows to Google Sheets",
    telemetry: {
      kind: "write" as const,
      label: "Write lead rows to Google Sheet",
      icon: "write",
      fromBerryId: "berry-open-web-search",
      toBerryId: "berry-google-sheet",
    },
  },
];

const GARDEN_ARTIFACT_ROOT =
  "~/Blueberry/Gardens/Blueberry Sales Leads/artifacts";

export const createInitialGardenState = (): GardenState => ({
  commands: [],
  agents: [],
  workRuns: [],
  berries: [],
  telemetry: [],
});

export const getVisibleBerries = (state: GardenState): Berry[] =>
  state.berries.filter((berry) => berry.onMap);

export const getLedgerEntries = (state: GardenState): LedgerEntry[] =>
  state.berries.map((berry) => ({
    ...berry,
    workRunTitle:
      state.workRuns.find((run) => run.id === berry.workRunId)?.title ??
      "Quick command",
  }));

export const submitCommand = (
  state: GardenState,
  text: string
): GardenState => {
  const route = classifyCommand(text);
  const agent = createMainAgent(state);
  const commandId = createId("command", state.commands.length + 1);

  if (route === "quick") {
    return {
      ...state,
      agents: [...state.agents, agent],
      commands: [
        ...state.commands,
        {
          id: commandId,
          text,
          route,
          status: "complete",
          mainAgentId: agent.id,
        },
      ],
    };
  }

  const workRunId = createId("work-run", state.workRuns.length + 1);

  return {
    ...state,
    agents: [
      ...state.agents,
      {
        ...agent,
        state: "planning",
        currentLabel: "Preparing a visible work plan",
      },
    ],
    commands: [
      ...state.commands,
      {
        id: commandId,
        text,
        route,
        status: "planning",
        mainAgentId: agent.id,
        workRunId,
      },
    ],
    workRuns: [
      ...state.workRuns,
      {
        id: workRunId,
        title: "Find Blueberry sales leads",
        commandId,
        mainAgentId: agent.id,
        status: "planning",
        plan: createLeadGenPlan(),
        step: 0,
      },
    ],
  };
};

export const approveWorkRun = (
  state: GardenState,
  workRunId: string
): GardenState => {
  const workRun = state.workRuns.find((candidate) => candidate.id === workRunId);
  if (!workRun) return state;

  return {
    ...state,
    commands: state.commands.map((command) =>
      command.workRunId === workRunId
        ? { ...command, status: "running" }
        : command
    ),
    agents: state.agents.map((agent) =>
      agent.id === workRun.mainAgentId
        ? {
            ...agent,
            state: "acting",
            currentLabel: "Reading Strawberry sales prospecting page",
          }
        : agent
    ),
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? { ...candidate, status: "running", step: 0 }
        : candidate
    ),
    berries: createDemoBerries(workRunId),
    telemetry: [
      {
        id: "telemetry-1",
        workRunId,
        agentId: workRun.mainAgentId,
        berryId: "berry-strawberry-home",
        kind: "intent",
        label: "Understand Strawberry's target customers",
        icon: "search",
      },
    ],
  };
};

export const advanceWorkRun = (
  state: GardenState,
  workRunId: string
): GardenState => {
  const workRun = state.workRuns.find((candidate) => candidate.id === workRunId);
  if (!workRun || workRun.status !== "running") return state;

  const stepIndex = workRun.step;
  if (stepIndex >= WORK_RUN_STEPS.length) {
    return completeWorkRun(state, workRunId);
  }

  const step = WORK_RUN_STEPS[stepIndex];
  const nextTelemetryId = `telemetry-${state.telemetry.length + 1}`;

  return {
    ...state,
    agents: state.agents.map((agent) =>
      agent.id === workRun.mainAgentId
        ? {
            ...agent,
            state: "acting",
            currentLabel: step.agentLabel,
          }
        : agent
    ),
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? { ...candidate, step: candidate.step + 1 }
        : candidate
    ),
    berries: state.berries.map((berry) => {
      if (step.telemetry.berryId && berry.id === step.telemetry.berryId) {
        return { ...berry, status: "reading" as const };
      }
      if (step.telemetry.toBerryId && berry.id === step.telemetry.toBerryId) {
        return { ...berry, status: "writing" as const };
      }
      return berry;
    }),
    telemetry: [
      ...state.telemetry,
      {
        id: nextTelemetryId,
        workRunId,
        agentId: workRun.mainAgentId,
        berryId: step.telemetry.berryId,
        fromBerryId: step.telemetry.fromBerryId,
        toBerryId: step.telemetry.toBerryId,
        kind: step.telemetry.kind,
        label: step.telemetry.label,
        icon: step.telemetry.icon,
      },
    ],
  };
};

export const completeWorkRun = (
  state: GardenState,
  workRunId: string
): GardenState => {
  const workRun = state.workRuns.find((candidate) => candidate.id === workRunId);
  if (!workRun) return state;

  const summaryBerry: Berry = {
    id: `berry-summary-${workRunId}`,
    kind: "work-run",
    title: "Lead-gen run",
    subtitle: "10 qualified leads · Sheet + XLSX backup",
    x: 560,
    y: 250,
    width: 280,
    height: 180,
    status: "complete",
    workRunId,
    onMap: true,
  };

  const reportBerry: Berry = {
    id: "berry-brief-report",
    kind: "report",
    title: "brief.md",
    subtitle: "Research brief",
    x: 0,
    y: 0,
    width: 240,
    height: 150,
    status: "complete",
    workRunId,
    onMap: false,
    filePath: `${GARDEN_ARTIFACT_ROOT}/brief.md`,
  };

  return {
    ...state,
    commands: state.commands.map((command) =>
      command.workRunId === workRunId
        ? { ...command, status: "complete" }
        : command
    ),
    agents: state.agents.map((agent) =>
      agent.id === workRun.mainAgentId
        ? {
            ...agent,
            state: "complete",
            currentLabel: "Work Run complete",
          }
        : agent
    ),
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? { ...candidate, status: "complete", step: WORK_RUN_STEPS.length }
        : candidate
    ),
    berries: [
      ...state.berries.map((berry) => {
        if (SOURCE_BERRY_IDS.includes(berry.id)) {
          return { ...berry, onMap: false, status: "complete" as const };
        }
        if (berry.kind === "sheet" || berry.kind === "xlsx") {
          return { ...berry, onMap: true, status: "complete" as const };
        }
        return berry;
      }),
      summaryBerry,
      reportBerry,
    ],
    telemetry: [
      ...state.telemetry,
      {
        id: `telemetry-${state.telemetry.length + 1}`,
        workRunId,
        agentId: workRun.mainAgentId,
        toBerryId: "berry-google-sheet",
        kind: "complete",
        label: "Lead-gen Work Run complete",
        icon: "complete",
      },
    ],
  };
};

export const hasActiveWorkRun = (state: GardenState): boolean =>
  state.workRuns.some(
    (run) => run.status === "planning" || run.status === "running"
  );

export const syncTabBerries = (
  state: GardenState,
  snapshots: TabBerrySnapshot[]
): GardenState => {
  if (hasActiveWorkRun(state)) return state;

  const preserved = state.berries.filter((berry) => !berry.browserTabId);
  const synced = snapshots.map((snapshot, index) => {
    const existing = state.berries.find(
      (berry) => berry.browserTabId === snapshot.browserTabId
    );
    const layout = layoutSyncedTabBerry(index);

    return {
      id: existing?.id ?? `berry-tab-${snapshot.browserTabId}`,
      kind: "tab" as const,
      browserTabId: snapshot.browserTabId,
      title: snapshot.title,
      subtitle: tabSubtitle(snapshot.url),
      url: snapshot.url,
      screenshotDataUrl: snapshot.screenshotDataUrl ?? existing?.screenshotDataUrl,
      x: existing?.x ?? layout.x,
      y: existing?.y ?? layout.y,
      width: existing?.width ?? 240,
      height: existing?.height ?? 170,
      status: existing?.status ?? ("idle" as const),
      onMap: existing?.onMap ?? true,
    };
  });

  return { ...state, berries: [...preserved, ...synced] };
};

export const getReaderContent = (berry: Berry): string | null => {
  if (berry.kind !== "report") return null;

  if (berry.id === "berry-brief-report" || berry.title === "brief.md") {
    return DEMO_BRIEF_MARKDOWN;
  }

  return `# ${berry.title}\n\n${berry.subtitle}`;
};

export const showBerryOnGarden = (
  state: GardenState,
  berryId: string
): GardenState => ({
  ...state,
  berries: state.berries.map((berry) =>
    berry.id === berryId
      ? {
          ...berry,
          onMap: true,
          x: berry.x > 0 ? berry.x : 620,
          y: berry.y > 0 ? berry.y : 520,
        }
      : berry
  ),
});

const classifyCommand = (text: string): CommandRoute => {
  const normalized = text.toLowerCase();
  const workSignals = [
    "find",
    "search",
    "compare",
    "extract",
    "write",
    "google sheets",
    "xlsx",
    "backup",
    "leads",
    "companies",
  ];

  return workSignals.some((signal) => normalized.includes(signal))
    ? "work-run"
    : "quick";
};

const createMainAgent = (state: GardenState): Agent => ({
  id: createId("agent", state.agents.length + 1),
  name: "Blue",
  role: "main",
  state: "idle",
  currentLabel: "Ready",
});

const createLeadGenPlan = (): WorkRunPlan => ({
  summary:
    "I will inspect Strawberry's positioning, search the open web for likely buyers, write qualified leads into Google Sheets, and keep an XLSX backup.",
  sources: [
    "Strawberry product page",
    "Strawberry sales prospecting page",
    "Open web search results",
    "Candidate company websites",
  ],
  qualificationCriteria: [
    "Company has browser-heavy sales, recruiting, operations, data, or research workflows",
    "Blueberry's visible browser-work UX would plausibly reduce repetitive web work",
    "There is source evidence for the segment or workflow fit",
  ],
  outputColumns: DEMO_OUTPUT_COLUMNS,
  destination: {
    primary: "Google Sheets",
    backup: "XLSX",
  },
  approvalCheckpoints: [
    "Plan approval before work starts",
    "Separate approval before sending messages or changing external systems",
  ],
});

const createDemoBerries = (workRunId: string): Berry[] => [
  {
    id: "berry-strawberry-home",
    kind: "tab",
    title: "Strawberry Browser",
    subtitle: "Product page",
    url: "https://strawberrybrowser.com/",
    x: 120,
    y: 110,
    width: 260,
    height: 170,
    status: "reading",
    workRunId,
    onMap: true,
  },
  {
    id: "berry-strawberry-sales",
    kind: "tab",
    title: "Sales Prospecting",
    subtitle: "Use case page",
    url: "https://strawberrybrowser.com/use-cases/sales-prospecting",
    x: 430,
    y: 150,
    width: 260,
    height: 170,
    status: "idle",
    workRunId,
    onMap: true,
  },
  {
    id: "berry-open-web-search",
    kind: "tab",
    title: "Open Web Search",
    subtitle: "Candidate discovery",
    x: 250,
    y: 390,
    width: 260,
    height: 170,
    status: "idle",
    workRunId,
    onMap: true,
  },
  {
    id: "berry-google-sheet",
    kind: "sheet",
    title: "Blueberry sales leads",
    subtitle: "Google Sheet destination",
    x: 820,
    y: 170,
    width: 300,
    height: 200,
    status: "idle",
    workRunId,
    onMap: true,
  },
  {
    id: "berry-xlsx-backup",
    kind: "xlsx",
    title: "Lead list backup",
    subtitle: "XLSX export",
    x: 880,
    y: 430,
    width: 240,
    height: 150,
    status: "idle",
    workRunId,
    onMap: true,
    filePath: `${GARDEN_ARTIFACT_ROOT}/leads.xlsx`,
  },
];

const createId = (prefix: string, index: number): string => `${prefix}-${index}`;

const DEMO_BRIEF_MARKDOWN = `# Blueberry sales lead brief

## Strawberry ICP (inferred)
- Browser-heavy sales, recruiting, operations, and research teams
- Teams that repeat web research, list building, and CRM prep in tabs
- Buyers who want visible agent work instead of hidden background automation

## Blueberry fit
- Spatial Garden makes multi-tab research legible
- Tab Berries + destination Berries show where work happens
- Intel Ledger keeps artifacts reachable without sidebar clutter

## Demo output
- 10 qualified companies in Google Sheets
- XLSX backup under \`~/Blueberry/Gardens/Blueberry Sales Leads/artifacts/\`
`;

const layoutSyncedTabBerry = (index: number): { x: number; y: number } => ({
  x: 80 + (index % 3) * 280,
  y: 120 + Math.floor(index / 3) * 210,
});

const tabSubtitle = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

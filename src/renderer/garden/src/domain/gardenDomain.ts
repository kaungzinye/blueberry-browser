export type CommandRoute = "quick" | "work-run" | "ambiguous";
export type CommandStatus =
  | "complete"
  | "planning"
  | "running"
  | "blocked"
  | "interrupted"
  /** Ambiguous route — waiting for the user to pick quick vs visible Work Run. */
  | "awaiting-route";
export type WorkRunStatus =
  | "planning"
  | "running"
  | "complete"
  | "blocked"
  | "interrupted";

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
  /** Compact Main Agent reply for quick-routed commands (PRD stories 11–12). */
  response?: string;
}

export interface WorkRunPlan {
  summary: string;
  sources: string[];
  qualificationCriteria: string[];
  outputColumns: string[];
  destination: {
    primary: string;
    backup?: string;
  };
  approvalCheckpoints: string[];
}

export interface WorkRun {
  id: string;
  title: string;
  commandId: string;
  mainAgentId: string;
  status: WorkRunStatus;
  planStatus: "drafting" | "ready";
  plan: WorkRunPlan;
  step: number;
}

export type BerryKind = "tab" | "sheet" | "xlsx" | "lead" | "report";

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
  /** True when this Tab Berry is the foreground browser tab. */
  isActive?: boolean;
}

export interface TabBerrySnapshot {
  browserTabId: string;
  title: string;
  url: string;
  screenshotDataUrl?: string;
  isActive?: boolean;
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

/**
 * Berry switcher filter (PRD story 9): fast fuzzy-ish matching over every
 * Berry — title, subtitle, or kind — for the ⌘K palette. Empty query → all.
 */
export const filterBerrySwitcher = (
  entries: LedgerEntry[],
  query: string,
): LedgerEntry[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) =>
    [entry.title, entry.subtitle, entry.kind, entry.workRunTitle].some(
      (field) => field?.toLowerCase().includes(needle),
    ),
  );
};

/**
 * Command Log entry (PRD stories 16–17): one row per Command with its exact
 * tool/action trace. Derived, not stored — the log is a view over commands +
 * telemetry, so it can never drift from what actually happened.
 */
export interface CommandLogEntry {
  commandId: string;
  text: string;
  route: CommandRoute;
  status: CommandStatus;
  response?: string;
  workRunTitle?: string;
  trace: TelemetryEvent[];
}

export const getCommandLog = (state: GardenState): CommandLogEntry[] =>
  state.commands.map((command) => ({
    commandId: command.id,
    text: command.text,
    route: command.route,
    status: command.status,
    response: command.response,
    workRunTitle: command.workRunId
      ? state.workRuns.find((run) => run.id === command.workRunId)?.title
      : undefined,
    trace: command.workRunId
      ? state.telemetry.filter((event) => event.workRunId === command.workRunId)
      : [],
  }));

export type SubmitCommandResult = {
  state: GardenState;
  mainAgentId: string;
  hint?: string;
};

export const submitCommand = (
  state: GardenState,
  text: string,
  mainAgentId?: string | null,
): SubmitCommandResult => {
  if (mainAgentId) {
    const command = state.commands.find(
      (candidate) => candidate.mainAgentId === mainAgentId,
    );
    if (!command) {
      return createCommandWithNewAgent(state, text);
    }
    if (command.status === "complete") {
      return {
        state,
        mainAgentId,
        hint: "This Command is completed. Start a New Command.",
      };
    }
    if (command.text.trim() && command.workRunId) {
      return {
        state,
        mainAgentId,
        hint: "This Command already has a Work Run. Start a New Command.",
      };
    }
    return {
      state: applyCommandText(state, command.id, text),
      mainAgentId,
    };
  }

  return createCommandWithNewAgent(state, text);
};

const applyCommandText = (
  state: GardenState,
  commandId: string,
  text: string,
): GardenState => {
  const command = state.commands.find(
    (candidate) => candidate.id === commandId,
  );
  if (!command) return state;

  const route = classifyCommand(text);

  if (route === "quick" || route === "ambiguous") {
    const ambiguous = route === "ambiguous";
    return {
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === command.mainAgentId
          ? {
              ...agent,
              state: ambiguous ? "idle" : "complete",
              currentLabel: ambiguous
                ? "Answer quickly or run visibly?"
                : "Quick response ready",
            }
          : agent,
      ),
      commands: state.commands.map((candidate) =>
        candidate.id === commandId
          ? {
              ...candidate,
              text,
              route,
              status: ambiguous ? "awaiting-route" : "complete",
            }
          : candidate,
      ),
    };
  }

  return promoteCommandToWorkRun(state, command, text);
};

/**
 * Put a command on the visible route: status planning, agent planning, and a
 * planned Work Run (created if the command does not already have one).
 */
const promoteCommandToWorkRun = (
  state: GardenState,
  command: Command,
  text: string,
): GardenState => {
  const workRunId =
    command.workRunId ?? createId("work-run", state.workRuns.length + 1);

  return {
    ...state,
    agents: state.agents.map((agent) =>
      agent.id === command.mainAgentId
        ? {
            ...agent,
            state: "planning",
            currentLabel: "Preparing a visible work plan",
          }
        : agent,
    ),
    commands: state.commands.map((candidate) =>
      candidate.id === command.id
        ? {
            ...candidate,
            text,
            route: "work-run",
            status: "planning",
            workRunId,
          }
        : candidate,
    ),
    workRuns: command.workRunId
      ? state.workRuns
      : [
          ...state.workRuns,
          {
            id: workRunId,
            title: createWorkRunTitle(text),
            commandId: command.id,
            mainAgentId: command.mainAgentId,
            status: "planning",
            planStatus: "drafting",
            plan: createPromptPlanDraft(text),
            step: 0,
          },
        ],
  };
};

/**
 * Attach the Main Agent's compact reply to a quick-routed command and mark it
 * complete. No-op for work-run commands — their output is the Work Run itself.
 */
export const attachQuickResponse = (
  state: GardenState,
  commandId: string,
  text: string,
): GardenState => {
  const command = state.commands.find(
    (candidate) => candidate.id === commandId,
  );
  if (!command || command.route === "work-run") return state;

  return {
    ...state,
    agents: state.agents.map((agent) =>
      agent.id === command.mainAgentId
        ? { ...agent, state: "complete", currentLabel: "Quick response ready" }
        : agent,
    ),
    commands: state.commands.map((candidate) =>
      candidate.id === commandId
        ? { ...candidate, response: text, status: "complete" }
        : candidate,
    ),
  };
};

/**
 * Upgrade a completed quick command into a visible Work Run (PRD story 15).
 * No-op unless the command is a completed quick command without a Work Run.
 */
export const upgradeCommand = (
  state: GardenState,
  commandId: string,
): GardenState => {
  const command = state.commands.find(
    (candidate) => candidate.id === commandId,
  );
  if (
    !command ||
    command.route !== "quick" ||
    command.status !== "complete" ||
    command.workRunId
  ) {
    return state;
  }
  return promoteCommandToWorkRun(state, command, command.text);
};

/**
 * Resolve an ambiguous command (PRD story 14): the user picked a quick answer
 * or a visible Work Run. No-op unless the command is awaiting a route.
 */
export const chooseRoute = (
  state: GardenState,
  commandId: string,
  route: "quick" | "work-run",
): GardenState => {
  const command = state.commands.find(
    (candidate) => candidate.id === commandId,
  );
  if (!command || command.status !== "awaiting-route") return state;

  if (route === "work-run") {
    return promoteCommandToWorkRun(state, command, command.text);
  }

  return {
    ...state,
    agents: state.agents.map((agent) =>
      agent.id === command.mainAgentId
        ? { ...agent, state: "complete", currentLabel: "Quick response ready" }
        : agent,
    ),
    commands: state.commands.map((candidate) =>
      candidate.id === commandId
        ? { ...candidate, route: "quick", status: "complete" }
        : candidate,
    ),
  };
};

const createCommandWithNewAgent = (
  state: GardenState,
  text: string,
): SubmitCommandResult => {
  const route = classifyCommand(text);
  const agent = createMainAgent(state);
  const commandId = createId("command", state.commands.length + 1);

  if (route === "quick" || route === "ambiguous") {
    return {
      mainAgentId: agent.id,
      state: {
        ...state,
        agents: [
          ...state.agents,
          route === "ambiguous"
            ? {
                ...agent,
                currentLabel: "Answer quickly or run visibly?",
              }
            : agent,
        ],
        commands: [
          ...state.commands,
          {
            id: commandId,
            text,
            route,
            status: route === "ambiguous" ? "awaiting-route" : "complete",
            mainAgentId: agent.id,
          },
        ],
      },
    };
  }

  const workRunId = createId("work-run", state.workRuns.length + 1);

  return {
    mainAgentId: agent.id,
    state: {
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
          title: createWorkRunTitle(text),
          commandId,
          mainAgentId: agent.id,
          status: "planning",
          planStatus: "drafting",
          plan: createPromptPlanDraft(text),
          step: 0,
        },
      ],
    },
  };
};

export const approveWorkRun = (
  state: GardenState,
  workRunId: string,
): GardenState => {
  const workRun = state.workRuns.find(
    (candidate) => candidate.id === workRunId,
  );
  if (!workRun) return state;

  return {
    ...state,
    commands: state.commands.map((command) =>
      command.workRunId === workRunId
        ? { ...command, status: "running" }
        : command,
    ),
    agents: state.agents.map((agent) =>
      agent.id === workRun.mainAgentId
        ? {
            ...agent,
            state: "acting",
            currentLabel: "Starting Work Run",
          }
        : agent,
    ),
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? { ...candidate, status: "running", step: 0 }
        : candidate,
    ),
    telemetry: state.telemetry,
  };
};

export const advanceWorkRun = (
  state: GardenState,
  workRunId: string,
): GardenState => {
  const workRun = state.workRuns.find(
    (candidate) => candidate.id === workRunId,
  );
  if (!workRun || workRun.status !== "running") return state;

  const nextTelemetryId = `telemetry-${state.telemetry.length + 1}`;

  return {
    ...state,
    agents: state.agents.map((agent) =>
      agent.id === workRun.mainAgentId
        ? {
            ...agent,
            state: "acting",
            currentLabel: "Advancing Work Run",
          }
        : agent,
    ),
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? { ...candidate, step: candidate.step + 1 }
        : candidate,
    ),
    telemetry: [
      ...state.telemetry,
      {
        id: nextTelemetryId,
        workRunId,
        agentId: workRun.mainAgentId,
        kind: "action",
        label: "Advanced Work Run",
        icon: "advance",
      },
    ],
  };
};

/** Shared status flip for failure/recovery transitions (PRD stories 45–47). */
const setWorkRunStatus = (
  state: GardenState,
  workRunId: string,
  runStatus: WorkRunStatus,
  agentState: Agent["state"],
  agentLabel: string,
  telemetry?: { kind: TelemetryKind; label: string; icon: string },
): GardenState => {
  const workRun = state.workRuns.find(
    (candidate) => candidate.id === workRunId,
  );
  if (!workRun) return state;

  return {
    ...state,
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? { ...candidate, status: runStatus }
        : candidate,
    ),
    commands: state.commands.map((command) =>
      command.workRunId === workRunId
        ? { ...command, status: runStatus as CommandStatus }
        : command,
    ),
    agents: state.agents.map((agent) =>
      agent.id === workRun.mainAgentId
        ? { ...agent, state: agentState, currentLabel: agentLabel }
        : agent,
    ),
    telemetry: telemetry
      ? [
          ...state.telemetry,
          {
            id: `telemetry-${state.telemetry.length + 1}`,
            workRunId,
            agentId: workRun.mainAgentId,
            ...telemetry,
          },
        ]
      : state.telemetry,
  };
};

/** A blocker hit the run: surface it on the run, the agent, and telemetry. */
export const blockWorkRun = (
  state: GardenState,
  workRunId: string,
  reason: string,
): GardenState =>
  setWorkRunStatus(
    state,
    workRunId,
    "blocked",
    "blocked",
    `Blocked: ${reason}`,
    {
      kind: "intent",
      label: `Blocked: ${reason}`,
      icon: "blocked",
    },
  );

/** User paused the run — cooperative stop, resumable via retry. */
export const pauseWorkRun = (
  state: GardenState,
  workRunId: string,
): GardenState =>
  setWorkRunStatus(state, workRunId, "interrupted", "idle", "Paused");

/** Resume a blocked or paused run with a visible retry attempt (story 47). */
export const retryWorkRun = (
  state: GardenState,
  workRunId: string,
): GardenState => {
  const workRun = state.workRuns.find(
    (candidate) => candidate.id === workRunId,
  );
  if (
    !workRun ||
    (workRun.status !== "blocked" && workRun.status !== "interrupted")
  ) {
    return state;
  }
  return setWorkRunStatus(
    state,
    workRunId,
    "running",
    "acting",
    "Retrying after blocker",
    { kind: "action", label: "Retrying after blocker", icon: "retry" },
  );
};

/**
 * Merge user edits into a plan section (PRD story 24). Only while the run is
 * still planning — an approved plan is the contract the run executes against.
 */
export const editWorkRunPlan = (
  state: GardenState,
  workRunId: string,
  patch: Partial<WorkRunPlan>,
): GardenState => {
  const workRun = state.workRuns.find(
    (candidate) => candidate.id === workRunId,
  );
  if (!workRun || workRun.status !== "planning") return state;

  return {
    ...state,
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? {
            ...candidate,
            planStatus: "ready",
            plan: { ...candidate.plan, ...patch },
          }
        : candidate,
    ),
  };
};

export const setWorkRunPlan = (
  state: GardenState,
  workRunId: string,
  plan: WorkRunPlan,
): GardenState => {
  const workRun = state.workRuns.find(
    (candidate) => candidate.id === workRunId,
  );
  if (!workRun || workRun.status !== "planning") return state;

  return {
    ...state,
    agents: state.agents.map((agent) =>
      agent.id === workRun.mainAgentId
        ? { ...agent, state: "planning", currentLabel: "Plan ready" }
        : agent,
    ),
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? { ...candidate, planStatus: "ready", plan }
        : candidate,
    ),
  };
};

/** What happens to source Berries when a run completes (PRD stories 60–61). */
export type SourceBerryChoice = "collapse" | "keep" | "close";

export const completeWorkRun = (
  state: GardenState,
  workRunId: string,
  sourceChoice: SourceBerryChoice = "collapse",
): GardenState => {
  const workRun = state.workRuns.find(
    (candidate) => candidate.id === workRunId,
  );
  if (!workRun) return state;

  return {
    ...state,
    commands: state.commands.map((command) =>
      command.workRunId === workRunId
        ? { ...command, status: "complete" }
        : command,
    ),
    agents: state.agents.map((agent) =>
      agent.id === workRun.mainAgentId
        ? {
            ...agent,
            state: "complete",
            currentLabel: "Work Run complete",
          }
        : agent,
    ),
    workRuns: state.workRuns.map((candidate) =>
      candidate.id === workRunId
        ? { ...candidate, status: "complete" }
        : candidate,
    ),
    berries: state.berries
      .filter(
        (berry) =>
          sourceChoice !== "close" ||
          berry.workRunId !== workRunId ||
          berry.kind !== "tab",
      )
      .map((berry) => {
        if (berry.workRunId !== workRunId) return berry;
        if (berry.kind === "tab") {
          return {
            ...berry,
            onMap: sourceChoice === "keep",
            status: "complete" as const,
          };
        }
        return { ...berry, onMap: true, status: "complete" as const };
      }),
    telemetry: [
      ...state.telemetry,
      {
        id: `telemetry-${state.telemetry.length + 1}`,
        workRunId,
        agentId: workRun.mainAgentId,
        kind: "complete",
        label: "Work Run complete",
        icon: "complete",
      },
    ],
  };
};

export const hasActiveWorkRun = (state: GardenState): boolean =>
  state.workRuns.some(
    (run) => run.status === "planning" || run.status === "running",
  );

export const syncTabBerries = (
  state: GardenState,
  snapshots: TabBerrySnapshot[],
): GardenState => {
  if (hasActiveWorkRun(state)) return state;

  const preserved = state.berries.filter((berry) => !berry.browserTabId);
  const synced = snapshots.map((snapshot, index) => {
    const existing = state.berries.find(
      (berry) => berry.browserTabId === snapshot.browserTabId,
    );
    const layout = layoutSyncedTabBerry(index);

    return {
      id: existing?.id ?? `berry-tab-${snapshot.browserTabId}`,
      kind: "tab" as const,
      browserTabId: snapshot.browserTabId,
      title: snapshot.title,
      subtitle: tabSubtitle(snapshot.url),
      url: snapshot.url,
      screenshotDataUrl:
        snapshot.screenshotDataUrl ?? existing?.screenshotDataUrl,
      x: existing?.x ?? layout.x,
      y: existing?.y ?? layout.y,
      width: existing?.width ?? 240,
      height: existing?.height ?? 170,
      status: existing?.status ?? ("idle" as const),
      onMap: existing?.onMap ?? true,
      isActive: snapshot.isActive ?? false,
    };
  });

  return { ...state, berries: [...preserved, ...synced] };
};

export const moveBerry = (
  state: GardenState,
  berryId: string,
  position: { x: number; y: number },
): GardenState => {
  const nextX = Math.round(position.x);
  const nextY = Math.round(position.y);
  let changed = false;

  const berries = state.berries.map((berry) => {
    if (berry.id !== berryId) return berry;
    changed = true;
    return { ...berry, x: nextX, y: nextY };
  });

  return changed ? { ...state, berries } : state;
};

export const getReaderContent = (berry: Berry): string | null => {
  if (berry.kind !== "report") return null;

  return `# ${berry.title}\n\n${berry.subtitle}`;
};

export const showBerryOnGarden = (
  state: GardenState,
  berryId: string,
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
      : berry,
  ),
});

const classifyCommand = (text: string): CommandRoute => {
  const normalized = text.toLowerCase();
  const visibleRunSignals = [
    "run visibly",
    "visible run",
    "visible work run",
    "work run",
    "work-run",
  ];
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

  const hasWorkSignal = workSignals.some((signal) =>
    normalized.includes(signal),
  );
  if (!hasWorkSignal) return "quick";

  const explicitlyVisibleRun = visibleRunSignals.some((signal) =>
    normalized.includes(signal),
  );
  if (explicitlyVisibleRun) return "work-run";

  // Work-shaped prompts may want either a quick answer or a visible Work Run.
  // Ask instead of silently turning typed text into a plan gate.
  return "ambiguous";
};

const createMainAgent = (state: GardenState): Agent => ({
  id: createId("agent", state.agents.length + 1),
  name: "Blue",
  role: "main",
  state: "idle",
  currentLabel: "Ready",
});

export const createPromptPlanDraft = (prompt: string): WorkRunPlan => ({
  summary: `Drafting a plan from: ${prompt}`,
  sources: ["The user's command", "Relevant open web or browser context"],
  qualificationCriteria: [
    "The plan should directly match the user's requested outcome",
    "Any external side effects need explicit approval before execution",
  ],
  outputColumns: [],
  destination: {
    primary: /google sheets/i.test(prompt)
      ? "Google Sheets"
      : "Output artifact in the Garden",
    backup: /xlsx|backup/i.test(prompt) ? "XLSX" : undefined,
  },
  approvalCheckpoints: [
    "Plan approval before work starts",
    "Separate approval before sending messages or changing external systems",
  ],
});

const createWorkRunTitle = (prompt: string): string => {
  const compact = prompt.trim().replace(/\s+/g, " ");
  if (!compact) return "Visible Work Run";
  return compact.length > 58 ? `${compact.slice(0, 55).trim()}...` : compact;
};

const createId = (prefix: string, index: number): string =>
  `${prefix}-${index}`;

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

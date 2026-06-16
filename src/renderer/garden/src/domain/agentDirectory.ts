import type { GardenState } from "./gardenDomain";
import { commandPreview, getCommandRosterStatus } from "./gardenRoster";

export interface DirectoryPendingApproval {
  id: string;
  agentId: string;
}

export type AgentDirectoryApproval =
  | { kind: "none" }
  | { kind: "approve-plan" }
  | { kind: "approve-action"; approvalId: string };

export interface AgentDirectoryRow {
  agentId: string;
  commandId: string;
  workRunId?: string;
  taskTitle: string;
  currentLabel: string;
  status: "active" | "done";
  selected: boolean;
  approval: AgentDirectoryApproval;
}

export interface AgentDirectoryView {
  active: AgentDirectoryRow[];
  done: AgentDirectoryRow[];
  hasApprovalBadge: boolean;
  hasActionApproval: boolean;
}

export const getAgentDirectoryView = (
  state: GardenState,
  selectedAgentId: string | null,
  pendingApproval: DirectoryPendingApproval | null,
): AgentDirectoryView => {
  const rows = state.commands.flatMap<AgentDirectoryRow>((command) => {
    const agent = state.agents.find(
      (candidate) => candidate.id === command.mainAgentId,
    );
    if (!agent || agent.role !== "main") return [];

    const workRun = command.workRunId
      ? state.workRuns.find((candidate) => candidate.id === command.workRunId)
      : undefined;
    const status =
      getCommandRosterStatus(command) === "completed" ? "done" : "active";
    const approval: AgentDirectoryApproval =
      pendingApproval?.agentId === agent.id
        ? { kind: "approve-action", approvalId: pendingApproval.id }
        : workRun?.status === "planning" && workRun.planStatus === "ready"
          ? { kind: "approve-plan" }
          : { kind: "none" };

    return [
      {
        agentId: agent.id,
        commandId: command.id,
        workRunId: command.workRunId,
        taskTitle: commandPreview(command),
        currentLabel: agent.currentLabel,
        status,
        selected: agent.id === selectedAgentId,
        approval,
      },
    ];
  });

  return {
    active: rows.filter((row) => row.status === "active"),
    done: rows.filter((row) => row.status === "done"),
    hasApprovalBadge: rows.some((row) => row.approval.kind !== "none"),
    hasActionApproval: rows.some(
      (row) => row.approval.kind === "approve-action",
    ),
  };
};

import type { WorkRunStatus } from "./gardenDomain";

export interface RunControlState {
  visible: boolean;
  enabled: boolean;
}

export interface RetryControlState extends RunControlState {
  label: "Retry" | "Resume";
}

export interface RunControlsView {
  visible: boolean;
  advance: RunControlState;
  pause: RunControlState;
  complete: RunControlState;
  retry: RetryControlState;
  sourceChoice: RunControlState;
}

const hiddenControl = (): RunControlState => ({
  visible: false,
  enabled: false,
});

export const emptyRunControlsView = (): RunControlsView => ({
  visible: false,
  advance: hiddenControl(),
  pause: hiddenControl(),
  complete: hiddenControl(),
  retry: { ...hiddenControl(), label: "Retry" },
  sourceChoice: hiddenControl(),
});

export const getRunControlsView = (
  status: WorkRunStatus | undefined,
): RunControlsView => {
  const view = emptyRunControlsView();

  if (status === "running") {
    return {
      ...view,
      visible: true,
      advance: { visible: true, enabled: true },
      pause: { visible: true, enabled: true },
    };
  }

  if (status === "complete") {
    return {
      ...view,
      visible: true,
      complete: { visible: true, enabled: true },
      sourceChoice: { visible: true, enabled: true },
    };
  }

  if (status === "blocked" || status === "interrupted") {
    return {
      ...view,
      visible: true,
      retry: {
        visible: true,
        enabled: true,
        label: status === "blocked" ? "Retry" : "Resume",
      },
    };
  }

  return view;
};

import React, { useMemo } from "react";
import type { Berry, TelemetryEvent } from "../domain/gardenDomain";
import {
  BERRY_STATUS_RING,
  getTelemetrySignature,
} from "../domain/telemetryVisuals";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface TelemetryLayerProps {
  berries: Berry[];
  telemetry: TelemetryEvent[];
}

/** World-space center of a Berry. */
const center = (b: Berry): { x: number; y: number } => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

/** Cubic path between two points, bowed for a readable flow arc. */
const flowPath = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): string => {
  const midX = (a.x + b.x) / 2;
  const lift = Math.min(120, Math.abs(b.x - a.x) * 0.3 + 40);
  return `M ${a.x} ${a.y} C ${midX} ${a.y - lift}, ${midX} ${b.y - lift}, ${b.x} ${b.y}`;
};

/**
 * Renders the live telemetry stream on top of the Garden world: source ->
 * destination data-flows, per-Berry status rings, and a floating label on the
 * most recent event. Coordinates are world-space (the SVG origin is aligned to
 * the world container's 0,0 via overflow-visible), so everything tracks the
 * Berry cards under pan/zoom.
 */
export const TelemetryLayer: React.FC<TelemetryLayerProps> = ({
  berries,
  telemetry,
}) => {
  const berryById = useMemo(
    () => new Map(berries.map((b) => [b.id, b])),
    [berries]
  );

  const flows = useMemo(
    () =>
      telemetry
        .map((event, index) => {
          if (!event.fromBerryId || !event.toBerryId) return null;
          const from = berryById.get(event.fromBerryId);
          const to = berryById.get(event.toBerryId);
          if (!from || !to) return null;
          return {
            event,
            recency: index,
            from: center(from),
            to: center(to),
          };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null),
    [telemetry, berryById]
  );

  const latest = telemetry.at(-1);
  const latestBerry = latest
    ? berryById.get(latest.toBerryId ?? latest.berryId ?? "")
    : undefined;
  const latestSig = latest ? getTelemetrySignature(latest.kind) : undefined;

  const lastFlowIndex = flows.length - 1;

  return (
    <div className="pointer-events-none absolute left-0 top-0">
      {/* Berry status rings — the live BerryStatus, finally visible. */}
      {berries.map((berry) => {
        if (berry.status === "idle") return null;
        const ring = BERRY_STATUS_RING[berry.status];
        return (
          <div
            key={`ring-${berry.id}`}
            className="pointer-events-none absolute rounded-[1.6rem]"
            style={{
              left: berry.x - 4,
              top: berry.y - 4,
              width: berry.width + 8,
              height: berry.height + 8,
              boxShadow: `0 0 0 1.5px ${ring.stroke}`,
            }}
          >
            {berry.status === "extracting" && (
              <span className="absolute inset-0 overflow-hidden rounded-[1.6rem]">
                <span
                  className="ring-scan absolute inset-y-0 w-1"
                  style={{ background: ring.stroke, opacity: 0.5 }}
                />
              </span>
            )}
          </div>
        );
      })}

      {/* Source -> destination data-flows. */}
      <svg
        className="absolute left-0 top-0"
        width={1}
        height={1}
        style={{ overflow: "visible" }}
        aria-hidden
      >
        {flows.map(({ event, from, to }, index) => {
          const sig = getTelemetrySignature(event.kind);
          const isLatest = index === lastFlowIndex;
          return (
            <g key={`flow-${event.id}`} opacity={isLatest ? 1 : 0.35}>
              <path
                d={flowPath(from, to)}
                fill="none"
                stroke={sig.stroke}
                strokeWidth={isLatest ? 2.5 : 1.5}
                strokeLinecap="round"
                className={isLatest ? "data-flow" : undefined}
                strokeDasharray={isLatest ? undefined : "2 8"}
              />
              <circle cx={to.x} cy={to.y} r={4} fill={sig.stroke} />
            </g>
          );
        })}
      </svg>

      {/* Pulse on the active Berry + floating label for the latest event. */}
      {latest && latestBerry && latestSig && (
        <>
          <div
            className="pulse-ring pointer-events-none absolute rounded-[1.6rem]"
            style={{
              left: latestBerry.x - 4,
              top: latestBerry.y - 4,
              width: latestBerry.width + 8,
              height: latestBerry.height + 8,
            }}
          />
          <div
            className="pointer-events-auto absolute"
            style={{
              left: latestBerry.x,
              top: latestBerry.y - 10,
              transform: "translateY(-100%)",
            }}
          >
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border bg-surface-1/90 px-2.5 py-1 font-mono text-[11px] shadow-lift backdrop-blur-sm ${latestSig.textClass}`}
                    style={{ borderColor: latestSig.stroke }}
                  >
                    <latestSig.Icon className="size-3.5" />
                    <span className="max-w-[200px] truncate text-ink">
                      {latest.label}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className={`font-mono ${latestSig.textClass}`}>
                    {latestSig.label}
                  </span>
                  <span className="ml-1.5 text-ink-muted">
                    {latestSig.meaning}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </>
      )}
    </div>
  );
};

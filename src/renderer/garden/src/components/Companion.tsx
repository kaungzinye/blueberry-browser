import React, { useRef, useState } from "react";
import type { CompanionClip } from "../domain/telemetryVisuals";
import {
  getCompanionSources,
  type CompanionSources,
} from "../domain/companionAssets";
import { cn } from "./ui/cn";

/**
 * The companion: a pre-rendered, transparent-background video loop framed by a
 * cropping container, with a transparent overlay that captures the pointer so
 * the companion "looks toward" the cursor (and can be dragged).
 *
 * No 3D / WebGL. Clips are dropped into assets/companions (see companionAssets
 * .ts); until then a lightweight placeholder renders so nothing breaks.
 */
interface CompanionProps {
  clip: CompanionClip;
  /** Main Agents read larger with a ground shadow; Subagents are smaller. */
  role?: "main" | "sub";
  blocked?: boolean;
  /** Display footprint (the cropping container) in px. */
  size?: number;
  character?: string;
  /** Video is rendered larger than the container so it can lean/peek out. */
  videoScale?: number;
  /** Allow dragging the companion within its parent. Off by default because
   * the Garden positions it from agent telemetry. */
  draggable?: boolean;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const Companion: React.FC<CompanionProps> = ({
  clip,
  role = "main",
  blocked = false,
  size = 150,
  character = "blue",
  videoScale = 1.3,
  draggable = false,
}) => {
  const sources = getCompanionSources(clip, character);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  const scaled = role === "sub" ? size * 0.72 : size;
  const videoSize = scaled * videoScale;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (dragStart.current) {
      setDrag({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      });
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    setLook({ x: clamp(dx, -1, 1), y: clamp(dy, -1, 1) });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!draggable) return;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: drag.x, oy: drag.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const endDrag = (): void => {
    dragStart.current = null;
  };

  // Head-turn toward the cursor (and a touch of follow translation).
  const lookTransform = `perspective(620px) rotateY(${look.x * 16}deg) rotateX(${
    -look.y * 11
  }deg) translate(${look.x * 5}px, ${look.y * 4}px)`;

  return (
    <div
      className={cn(
        "companion-container relative select-none",
        blocked && "blocker-shake",
      )}
      style={{
        width: scaled,
        height: scaled,
        overflow: "hidden",
        transform: `translate(${drag.x}px, ${drag.y}px)`,
      }}
    >
      {/* Centered, oversized stage; the container crops it. */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: videoSize,
          height: videoSize,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Bob (translateY) and look-at (perspective/rotate) live on separate
            elements so the CSS animation and inline transform don't clobber
            each other. */}
        <div className="companion-bob h-full w-full">
          <div
            className="h-full w-full"
            style={{
              transform: lookTransform,
              transformStyle: "preserve-3d",
              transition: "transform 0.18s ease-out",
            }}
          >
            {sources ? (
              <CompanionVideo
                sources={sources}
                clipKey={`${character}-${clip}`}
              />
            ) : (
              <PlaceholderCompanion look={look} blocked={blocked} clip={clip} />
            )}
          </div>
        </div>
      </div>

      {role === "main" && (
        <span
          className="pointer-events-none absolute bottom-1.5 left-1/2 h-2 -translate-x-1/2 rounded-[50%] bg-black/35 blur-[3px]"
          style={{ width: scaled * 0.5 }}
          aria-hidden
        />
      )}

      {/* Pointer-capture surface. */}
      <div
        className="absolute inset-0"
        style={{ cursor: draggable ? "grab" : "default" }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setLook({ x: 0, y: 0 })}
        onPointerDown={handlePointerDown}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  );
};

/**
 * Looping transparent video. webm (VP9 alpha) is listed first because Blueberry
 * runs on Electron/Chromium; the HEVC hvc1 mp4 is there for WebKit. Keyed on the
 * resolved clip so swapping state remounts and autoplays the new loop.
 */
const CompanionVideo: React.FC<{
  sources: CompanionSources;
  clipKey: string;
}> = ({ sources, clipKey }) => (
  <video
    key={sources.webm ?? sources.mp4 ?? clipKey}
    className="h-full w-full object-contain"
    autoPlay
    loop
    muted
    playsInline
    disablePictureInPicture
    preload="auto"
    poster={sources.poster}
  >
    {sources.webm && <source src={sources.webm} type="video/webm" />}
    {sources.mp4 && (
      <source src={sources.mp4} type='video/mp4; codecs="hvc1"' />
    )}
  </video>
);

/**
 * DOM/SVG placeholder shown until real clips are bundled. This is the telemetry
 * visualization "now": the humanoid renders a distinct, animated pose per clip
 * — walking waddles, looking sweeps a magnifier, typing taps its hands,
 * thinking shows pulsing thought dots, cheer bounces with sparkles, blocked
 * stops with a warning — so every telemetry state reads at a glance without any
 * video asset. Eyes always track the cursor. Animations live in index.css
 * (`.cmp-*`) and respect prefers-reduced-motion.
 */
const PlaceholderCompanion: React.FC<{
  look: { x: number; y: number };
  blocked: boolean;
  clip: CompanionClip;
}> = ({ look, blocked, clip }) => {
  const ex = look.x * 4;
  const ey = look.y * 3;
  const body = blocked ? "#5b6480" : "#5b8cff";
  const head = blocked ? "#9aa6c4" : "#bcd4ff";
  return (
    <svg
      viewBox="0 0 100 100"
      className={`h-full w-full cmp cmp-${clip}`}
      aria-hidden
    >
      {/* Legs — only present (and swinging) while walking between Berries. */}
      {clip === "walking" && (
        <g>
          <rect
            className="cmp-leg cmp-leg-l"
            x="40"
            y="84"
            width="7"
            height="14"
            rx="3.5"
            fill={body}
          />
          <rect
            className="cmp-leg cmp-leg-r"
            x="53"
            y="84"
            width="7"
            height="14"
            rx="3.5"
            fill={body}
          />
        </g>
      )}

      {/* Body + head + cursor-tracking eyes. */}
      <g className="cmp-torso">
        <ellipse cx="50" cy="62" rx="26" ry="28" fill={body} />
        <circle cx="50" cy="36" r="22" fill={head} />
        <circle cx={42 + ex} cy={34 + ey} r="3.6" fill="#10131c" />
        <circle cx={58 + ex} cy={34 + ey} r="3.6" fill="#10131c" />
      </g>

      {/* Typing: two hands tapping below the body. */}
      {clip === "typing" && (
        <g fill={head}>
          <circle className="cmp-hand cmp-hand-l" cx="36" cy="80" r="5" />
          <circle className="cmp-hand cmp-hand-r" cx="64" cy="80" r="5" />
        </g>
      )}

      {/* Looking/observing: a magnifier sweeping across the field. */}
      {clip === "looking" && (
        <g className="cmp-scan" stroke="#10131c" strokeWidth="2.5" fill="none">
          <circle cx="70" cy="44" r="6" />
          <line x1="74.5" y1="48.5" x2="80" y2="54" strokeLinecap="round" />
        </g>
      )}

      {/* Thinking/intent/decision: pulsing thought dots. */}
      {clip === "thinking" && (
        <g fill="#bcd4ff">
          <circle className="cmp-dot cmp-dot-1" cx="72" cy="18" r="2.6" />
          <circle className="cmp-dot cmp-dot-2" cx="80" cy="13" r="3" />
          <circle className="cmp-dot cmp-dot-3" cx="89" cy="9" r="3.4" />
        </g>
      )}

      {/* Cheer/complete: arms up + twinkling sparkles. */}
      {clip === "cheer" && (
        <>
          <g stroke={body} strokeWidth="5" strokeLinecap="round">
            <line x1="28" y1="58" x2="18" y2="42" />
            <line x1="72" y1="58" x2="82" y2="42" />
          </g>
          <g className="cmp-spark" fill="#ffd76a">
            <path d="M20 22 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 z" />
            <path d="M82 24 l1.5 3.8 3.8 1.5 -3.8 1.5 -1.5 3.8 -1.5 -3.8 -3.8 -1.5 3.8 -1.5 z" />
          </g>
        </>
      )}

      {blocked && (
        <text
          x="50"
          y="17"
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill="#fbbf24"
        >
          !
        </text>
      )}
    </svg>
  );
};

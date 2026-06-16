/// <reference types="vite/client" />
import type { CompanionClip } from "./telemetryVisuals";

/**
 * Companion clips are pre-rendered, transparent-background video loops. One clip
 * per state, named `{character}-{state}` (e.g. blue-idle.webm).
 *
 * Drop files into:
 *   assets/companions/{character}-{state}.webm   (VP9 alpha — Chromium/Electron)
 *   assets/companions/{character}-{state}.mp4    (HEVC hvc1 alpha — WebKit, optional)
 *   assets/companions/posters/{character}-{state}.webp
 *
 * Nothing here is required for the build: until clips exist these globs resolve
 * empty and Companion.tsx renders a placeholder. See assets/companions/README.md.
 */

type UrlMap = Record<string, string>;

const webmFiles = import.meta.glob("../assets/companions/*.webm", {
  eager: true,
  query: "?url",
  import: "default",
}) as UrlMap;

const mp4Files = import.meta.glob("../assets/companions/*.mp4", {
  eager: true,
  query: "?url",
  import: "default",
}) as UrlMap;

const posterFiles = import.meta.glob("../assets/companions/posters/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as UrlMap;

/** Re-key a glob result by file basename without extension (e.g. "blue-idle"). */
const byBasename = (files: UrlMap): UrlMap => {
  const out: UrlMap = {};
  for (const [path, url] of Object.entries(files)) {
    const base = path
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "");
    if (base) out[base] = url;
  }
  return out;
};

const webm = byBasename(webmFiles);
const mp4 = byBasename(mp4Files);
const poster = byBasename(posterFiles);

export interface CompanionSources {
  webm?: string;
  mp4?: string;
  poster?: string;
}

/** Which states a clip falls back to when its own file is missing. */
const FALLBACK: Record<CompanionClip, CompanionClip[]> = {
  idle: [],
  walking: ["idle"],
  thinking: ["idle"],
  looking: ["idle"],
  typing: ["idle"],
  cheer: ["idle"],
  blocked: ["idle"],
};

/**
 * Resolve the best available sources for a character + clip, walking the
 * fallback chain. Returns null when no clip (not even idle) is present, so the
 * caller can render the placeholder.
 */
export const getCompanionSources = (
  clip: CompanionClip,
  character = "blue",
): CompanionSources | null => {
  for (const state of [clip, ...FALLBACK[clip]]) {
    const key = `${character}-${state}`;
    if (webm[key] || mp4[key]) {
      return { webm: webm[key], mp4: mp4[key], poster: poster[key] };
    }
  }
  return null;
};

/** True when at least one companion clip is bundled. */
export const hasCompanionClips = (): boolean =>
  Object.keys(webm).length > 0 || Object.keys(mp4).length > 0;

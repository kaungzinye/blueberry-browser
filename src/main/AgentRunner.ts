import { streamText, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { homedir } from "os";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import type { WebContents } from "electron";
import type { Window } from "./Window";

// ── IPC channel ───────────────────────────────────────────────────────────────

export const AGENT_PATCH_CHANNEL = "garden-agent-patch";

// ── Patch types (mirrored in garden.d.ts) ────────────────────────────────────

export type AgentState = "idle" | "planning" | "moving" | "acting" | "blocked" | "complete";
export type BerryKind = "tab" | "sheet" | "xlsx" | "lead" | "report" | "work-run";
export type BerryStatus = "idle" | "reading" | "extracting" | "writing" | "complete";
export type TelemetryKind =
  | "intent"
  | "action"
  | "observation"
  | "decision"
  | "tool_call"
  | "write"
  | "complete";

export interface PatchBerry {
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

export interface PatchTelemetryEvent {
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

export type GardenStatePatch =
  | { type: "berry-created"; berry: PatchBerry }
  | { type: "berry-status"; berryId: string; status: BerryStatus }
  | { type: "berry-screenshot"; berryId: string; screenshotDataUrl: string }
  | { type: "telemetry"; event: PatchTelemetryEvent }
  | { type: "agent-state"; agentId: string; state: AgentState; currentLabel: string }
  | { type: "command-status"; commandId: string; status: "complete" | "planning" | "running" | "blocked" }
  | { type: "work-run-status"; workRunId: string; status: "planning" | "running" | "complete" | "blocked" };

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a Main Agent in Blueberry Browser — a spatial browser-workspace where your work appears on a Garden canvas as Berries.

## Tools
- navigate_tab: Open a URL in a real Chromium tab, wait for page load, read the text, take a screenshot. Creates a Tab Berry.
- search_web: Search DuckDuckGo for pages matching a query. Returns URLs + snippets to navigate to.
- write_artifact: Save an output file to the Garden artifacts folder. Creates an Artifact Berry.
- annotate: Record your intent, decisions, and observations as telemetry (no side effects).

## Work protocol
1. Call annotate(intent, "…") to state your overall goal first.
2. Use search_web to discover URLs, then navigate_tab to read them.
3. Call annotate(decision, "…") at meaningful branch points.
4. Write all outputs with write_artifact before finishing.
5. Call annotate(complete, "…") when all outputs are written.

## Label rules
Labels appear in the UI at small size. Keep them ≤ 60 chars, present-tense, action-first.
✓ "Reading Strawberry sales page"   ✗ "I am now going to read the page"`;

// ── RunCommandOpts ────────────────────────────────────────────────────────────

export interface RunCommandOpts {
  commandText: string;
  commandId: string;
  agentId: string;
  workRunId: string;
  gardenName?: string;
}

// ── AgentRunner ───────────────────────────────────────────────────────────────

export class AgentRunner {
  private readonly gardenWC: WebContents;
  private readonly window: Window;
  private telemSeq = 0;

  constructor(window: Window) {
    this.window = window;
    this.gardenWC = window.garden.view.webContents;
  }

  private emit(patch: GardenStatePatch): void {
    if (!this.gardenWC.isDestroyed()) {
      this.gardenWC.send(AGENT_PATCH_CHANNEL, patch);
    }
  }

  private tid(): string {
    return `t-${Date.now()}-${++this.telemSeq}`;
  }

  private getModel() {
    if (process.env.LLM_PROVIDER?.toLowerCase() === "openai") {
      return openai(process.env.LLM_MODEL ?? "gpt-4o");
    }
    return anthropic(process.env.LLM_MODEL ?? "claude-sonnet-4-6");
  }

  private hasApiKey(): boolean {
    const provider = process.env.LLM_PROVIDER?.toLowerCase() ?? "anthropic";
    return provider === "openai"
      ? Boolean(process.env.OPENAI_API_KEY)
      : Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async run(opts: RunCommandOpts): Promise<void> {
    const { commandText, commandId, agentId, workRunId, gardenName = "Default" } = opts;

    if (!this.hasApiKey()) {
      this.emit({
        type: "agent-state",
        agentId,
        state: "blocked",
        currentLabel: "No API key — add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env",
      });
      return;
    }

    const artifactsDir = join(homedir(), "Blueberry", "Gardens", gardenName, "artifacts");
    await mkdir(artifactsDir, { recursive: true });

    this.emit({ type: "agent-state", agentId, state: "planning", currentLabel: "Planning work" });
    this.emit({ type: "work-run-status", workRunId, status: "running" });
    this.emit({ type: "command-status", commandId, status: "running" });

    // Berry layout: 3-column grid, resets per run
    let berryIdx = 0;
    const nextPos = () => {
      const i = berryIdx++;
      return { x: 80 + (i % 3) * 310, y: 120 + Math.floor(i / 3) * 230 };
    };

    const self = this;

    // ── Tools (v5: field is `inputSchema`, not `parameters`) ──────────────────

    const navigate_tab = tool({
      description:
        "Open a URL in a real Chromium browser tab, wait for page load, read page text and take a screenshot. Creates a Tab Berry on the garden canvas.",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: z.object({
        url: z.string().describe("Full URL including https://"),
        label: z.string().describe("Short label shown on the Berry, e.g. 'Strawberry product page'"),
      }) as any,
      execute: async ({ url, label }: { url: string; label: string }) => {
        const tab = self.window.createTab(url);
        const berryId = `berry-tab-${tab.id}`;
        const pos = nextPos();

        self.emit({
          type: "berry-created",
          berry: {
            id: berryId, kind: "tab", title: label,
            subtitle: safeHostname(url), url,
            x: pos.x, y: pos.y, width: 260, height: 170,
            status: "reading", workRunId, onMap: true, browserTabId: tab.id,
          },
        });
        self.emit({ type: "agent-state", agentId, state: "acting", currentLabel: `Reading ${label}` });
        self.emit({
          type: "telemetry",
          event: { id: self.tid(), workRunId, agentId, berryId, kind: "action", label: `Reading ${label}`, icon: "read" },
        });

        // Wait for page load (8 s max)
        await new Promise<void>((resolve) => {
          tab.webContents.once("did-finish-load", resolve);
          setTimeout(resolve, 8_000);
        });

        self.emit({ type: "berry-status", berryId, status: "extracting" });

        let text = "";
        try { text = (await tab.getTabText()).slice(0, 6_000); }
        catch { text = "(Could not extract page text)"; }

        try {
          const img = await tab.screenshot();
          // Skip empty captures (hidden/unpainted views) — they render as a
          // broken thumbnail in the garden.
          if (!img.isEmpty()) {
            self.emit({ type: "berry-screenshot", berryId, screenshotDataUrl: img.toDataURL() });
          }
        } catch { /* non-fatal */ }

        self.emit({ type: "berry-status", berryId, status: "complete" });
        self.emit({
          type: "telemetry",
          event: { id: self.tid(), workRunId, agentId, berryId, kind: "observation", label: `Read ${label}`, icon: "eye" },
        });

        return { tabId: tab.id, berryId, url, title: tab.title || label, text };
      },
    });

    const search_web = tool({
      description:
        "Search DuckDuckGo for pages matching a query. Returns up to 8 results with {url, title, snippet}. Use navigate_tab on results you want to read.",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: z.object({
        query: z.string().describe("Search query"),
      }) as any,
      execute: async ({ query }: { query: string }) => {
        const short = query.slice(0, 50);
        self.emit({ type: "agent-state", agentId, state: "acting", currentLabel: `Searching: ${short}` });
        self.emit({
          type: "telemetry",
          event: { id: self.tid(), workRunId, agentId, kind: "action", label: `Searching: ${short}`, icon: "search" },
        });

        try {
          const resp = await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
            { signal: AbortSignal.timeout(10_000) }
          );
          const data = (await resp.json()) as {
            Results?: Array<{ FirstURL?: string; Text?: string }>;
            RelatedTopics?: Array<{ FirstURL?: string; Text?: string; Name?: string }>;
          };

          const results = [
            ...(data.Results ?? []),
            ...(data.RelatedTopics ?? []).filter((t) => t.FirstURL && !t.Name),
          ]
            .filter((r): r is { FirstURL: string; Text: string } => Boolean(r.FirstURL && r.Text))
            .slice(0, 8)
            .map((r) => ({
              url: r.FirstURL,
              title: r.Text.split(" - ")[0]?.slice(0, 80) ?? r.Text.slice(0, 80),
              snippet: r.Text,
            }));

          self.emit({
            type: "telemetry",
            event: { id: self.tid(), workRunId, agentId, kind: "observation", label: `Found ${results.length} results`, icon: "eye" },
          });

          return { results };
        } catch (err) {
          return { results: [], error: String(err) };
        }
      },
    });

    const write_artifact = tool({
      description:
        "Write output content to a file in the Garden artifacts folder and create an Artifact Berry on the canvas.",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: z.object({
        filename: z.string().describe("Filename with extension, e.g. 'leads.md'"),
        content: z.string().describe("Full file content"),
        kind: z.enum(["report", "lead", "xlsx"]).describe("Berry kind: report for Markdown, lead for lead lists"),
        title: z.string().describe("Display title shown on the Berry"),
        subtitle: z.string().describe("One-line description shown under the title"),
      }) as any,
      execute: async ({
        filename, content, kind, title, subtitle,
      }: { filename: string; content: string; kind: "report" | "lead" | "xlsx"; title: string; subtitle: string }) => {
        const filePath = join(artifactsDir, filename);
        await writeFile(filePath, content, "utf-8");

        const berryId = `berry-artifact-${filename.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
        const pos = nextPos();

        self.emit({
          type: "berry-created",
          berry: {
            id: berryId, kind, title, subtitle,
            x: pos.x, y: pos.y, width: 280, height: 150,
            status: "writing", workRunId, onMap: true, filePath,
          },
        });
        self.emit({ type: "agent-state", agentId, state: "acting", currentLabel: `Writing ${title}` });
        self.emit({
          type: "telemetry",
          event: { id: self.tid(), workRunId, agentId, berryId, kind: "write", label: `Writing ${title}`, icon: "write" },
        });

        // Small visual pause so the writing state registers
        await new Promise((r) => setTimeout(r, 400));

        self.emit({ type: "berry-status", berryId, status: "complete" });
        self.emit({
          type: "telemetry",
          event: { id: self.tid(), workRunId, agentId, berryId, kind: "complete", label: `Wrote ${title}`, icon: "check" },
        });

        return { berryId, filePath, filename };
      },
    });

    const annotate = tool({
      description:
        "Record your intent, a key decision, an observation, or completion as a telemetry event visible in the Garden. No side effects — pure signal.",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: z.object({
        kind: z.enum(["intent", "decision", "observation", "complete"]).describe("Telemetry kind"),
        label: z.string().max(80).describe("What you are doing or decided, ≤ 60 chars, present-tense"),
        berryId: z.string().optional().describe("Berry this annotation relates to, if any"),
      }) as any,
      execute: async ({
        kind, label, berryId,
      }: { kind: "intent" | "decision" | "observation" | "complete"; label: string; berryId?: string }) => {
        const agentState: AgentState =
          kind === "complete" ? "complete" : kind === "intent" ? "planning" : "acting";

        self.emit({ type: "agent-state", agentId, state: agentState, currentLabel: label });
        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(), workRunId, agentId, berryId, kind,
            label,
            icon: kind === "intent" ? "compass" : kind === "decision" ? "branch" : kind === "complete" ? "check" : "eye",
          },
        });

        return { recorded: true };
      },
    });

    // ── Stream ────────────────────────────────────────────────────────────────

    try {
      const result = streamText({
        model: this.getModel(),
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: commandText }],
        tools: { navigate_tab, search_web, write_artifact, annotate },
        stopWhen: stepCountIs(30),
      });

      // Iterate fullStream to drive execution.
      // All telemetry + patches emit from inside tool execute() calls.
      for await (const part of result.fullStream) {
        if (part.type === "error") {
          throw new Error(String((part as { type: "error"; error: unknown }).error));
        }
      }

      this.emit({ type: "agent-state", agentId, state: "complete", currentLabel: "Work complete" });
      this.emit({ type: "command-status", commandId, status: "complete" });
      this.emit({ type: "work-run-status", workRunId, status: "complete" });
    } catch (error) {
      console.error("[AgentRunner] Stream error:", error);
      const msg = error instanceof Error ? error.message.slice(0, 80) : "Unexpected error";
      this.emit({ type: "agent-state", agentId, state: "blocked", currentLabel: msg });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

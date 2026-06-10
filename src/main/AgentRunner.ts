import { streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { homedir } from "os";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import type { Window } from "./Window";
import type { GardenStore } from "./garden/GardenStore";
import type { GardenStatePatch } from "../renderer/garden/src/domain/gardenPatches";
import {
  resolve,
  requiresApproval,
  narrate,
  createRecorder,
  extractDigest,
  executeAction,
  playOverlay,
  type ActionKind,
  type Recorder,
} from "./browser-use";

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a Main Agent in Blueberry Browser — a spatial browser-workspace where your work appears on a Garden canvas as Berries.

## Tools
- navigate_tab: Open a URL in a real Chromium tab, wait for page load, read the text, take a screenshot. Creates a Tab Berry.
- search_web: Search DuckDuckGo for pages matching a query. Returns URLs + snippets to navigate to.
- browser_action: Operate the live tab — click, type, scroll, select, press a key — targeting elements in natural language. Each action is narrated on the page.
- write_artifact: Save an output file to the Garden artifacts folder. Creates an Artifact Berry.
- annotate: Record your intent, decisions, and observations as telemetry (no side effects).

## Work protocol
1. Call annotate(intent, "…") to state your overall goal first.
2. Use search_web to discover URLs, then navigate_tab to read them.
3. To operate a page (log in, fill a form, step through a flow), use browser_action. Describe targets in plain language ("the search box", "the Sign in button").
4. browser_action HARD-STOPS for user approval before consequential steps (submit/purchase/send/login/upload). It blocks until the user decides. If it returns denied, do NOT retry — pick a different approach or stop and explain.
5. If browser_action returns a miss, inspect the returned 'available' elements and re-phrase your target, or navigate/scroll to bring it into view.
6. Call annotate(decision, "…") at meaningful branch points.
7. Write all outputs with write_artifact before finishing.
8. Call annotate(complete, "…") when all outputs are written.

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

type Turn = ModelMessage;

// ── AgentRunner — a long-lived Main Agent session (ADR-0003) ────────────────────
//
// Replaces the one-shot fire-and-forget runner: it owns conversation history and
// an inbound channel (follow-up turns + approval decisions). Patches apply
// directly to the main-owned GardenStore — there is no patch-to-renderer hop.
// The browser_action risk gate is a BLOCKING await on an approval promise the
// inbound channel resolves, not a "stop" string handed back to the model.

export class AgentRunner {
  private readonly window: Window;
  private readonly store: GardenStore;
  private telemSeq = 0;

  // ── Session identity (set on run) ──
  private agentId = "";
  private commandId = "";
  private workRunId = "";
  private gardenName = "Default";
  private artifactsDir = "";

  // ── Conversation + inbound channel ──
  private messages: Turn[] = [];
  private running = false;
  private readonly pendingTurns: string[] = [];
  /** approvalId → resolver, set while an Approval gate is open. */
  private readonly approvals = new Map<string, (approved: boolean) => void>();

  // ── Cross-turn run state ──
  private recorder: Recorder = createRecorder();
  private browserActionCount = 0;
  private lastSourceBerryId: string | undefined;
  private berryIdx = 0;
  private apprSeq = 0;

  constructor(window: Window, store: GardenStore) {
    this.window = window;
    this.store = store;
  }

  // ── Inbound channel ────────────────────────────────────────────────────────

  /** Deliver a follow-up turn. Queues if a stream is mid-flight; else streams now. */
  submitTurn(text: string): void {
    if (this.running) {
      this.pendingTurns.push(text);
      return;
    }
    this.messages.push({ role: "user", content: text });
    void this.drive();
  }

  /** Resolve an open Approval gate (Approve/Deny from the Command Bar). */
  resolveApproval(approvalId: string, approved: boolean): void {
    const resolver = this.approvals.get(approvalId);
    if (resolver) {
      this.approvals.delete(approvalId);
      resolver(approved);
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private emit(patch: GardenStatePatch): void {
    this.store.applyAgentPatch(patch);
  }

  private tid(): string {
    return `t-${Date.now()}-${++this.telemSeq}`;
  }

  private nextPos(): { x: number; y: number } {
    const i = this.berryIdx++;
    return { x: 80 + (i % 3) * 310, y: 120 + Math.floor(i / 3) * 230 };
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

  // ── Run ──────────────────────────────────────────────────────────────────

  async run(opts: RunCommandOpts): Promise<void> {
    this.agentId = opts.agentId;
    this.commandId = opts.commandId;
    this.workRunId = opts.workRunId;
    this.gardenName = opts.gardenName ?? "Default";

    if (!this.hasApiKey()) {
      this.emit({
        type: "agent-state",
        agentId: this.agentId,
        state: "blocked",
        currentLabel:
          "No API key — add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env",
      });
      return;
    }

    this.artifactsDir = join(
      homedir(),
      "Blueberry",
      "Gardens",
      this.gardenName,
      "artifacts",
    );
    await mkdir(this.artifactsDir, { recursive: true });

    this.messages = [{ role: "user", content: opts.commandText }];
    this.recorder = createRecorder();
    this.browserActionCount = 0;
    this.berryIdx = 0;
    this.lastSourceBerryId = undefined;

    this.emit({
      type: "agent-state",
      agentId: this.agentId,
      state: "planning",
      currentLabel: "Planning work",
    });
    this.emit({
      type: "work-run-status",
      workRunId: this.workRunId,
      status: "running",
    });
    this.emit({
      type: "command-status",
      commandId: this.commandId,
      status: "running",
    });

    await this.drive();
  }

  // ── Drive: stream until the model stops, then drain queued follow-up turns ──

  private async drive(): Promise<void> {
    this.running = true;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const tools = this.buildTools();
        const result = streamText({
          model: this.getModel(),
          system: SYSTEM_PROMPT,
          messages: this.messages,
          tools,
          stopWhen: stepCountIs(30),
        });

        for await (const part of result.fullStream) {
          if (part.type === "error") {
            throw new Error(
              String((part as { type: "error"; error: unknown }).error),
            );
          }
        }

        const text = await result.text;
        if (text) this.messages.push({ role: "assistant", content: text });

        // Fold in any follow-up turn that arrived mid-stream, then loop.
        const queued = this.pendingTurns.shift();
        if (queued) {
          this.messages.push({ role: "user", content: queued });
          continue;
        }
        break;
      }

      this.exportPlaywrightIfRecorded();

      this.emit({
        type: "agent-state",
        agentId: this.agentId,
        state: "complete",
        currentLabel: "Work complete",
      });
      this.emit({
        type: "command-status",
        commandId: this.commandId,
        status: "complete",
      });
      this.emit({
        type: "work-run-status",
        workRunId: this.workRunId,
        status: "complete",
      });
    } catch (error) {
      console.error("[AgentRunner] Stream error:", error);
      const msg =
        error instanceof Error
          ? error.message.slice(0, 80)
          : "Unexpected error";
      this.emit({
        type: "agent-state",
        agentId: this.agentId,
        state: "blocked",
        currentLabel: msg,
      });
    } finally {
      this.running = false;
    }
  }

  // ── Approval gate: block until the inbound channel resolves ─────────────────

  private requestApproval(caption: string, reason: string): Promise<boolean> {
    const id = `appr-${Date.now()}-${++this.apprSeq}`;
    this.store.setPendingApproval({
      id,
      agentId: this.agentId,
      commandId: this.commandId,
      caption,
      reason,
    });
    return new Promise<boolean>((resolveApproval) => {
      this.approvals.set(id, resolveApproval);
    }).finally(() => {
      this.store.clearPendingApproval();
    });
  }

  private emitToolCall(label: string, berryId?: string): void {
    this.emit({
      type: "telemetry",
      event: {
        id: this.tid(),
        workRunId: this.workRunId,
        agentId: this.agentId,
        berryId,
        kind: "tool_call",
        label,
        icon: "tool",
      },
    });
  }

  // ── Tools ──────────────────────────────────────────────────────────────────

  private buildTools() {
    const self = this;

    const navigate_tab = tool({
      description:
        "Open a URL in a real Chromium browser tab, wait for page load, read page text and take a screenshot. Creates a Tab Berry on the garden canvas.",
      inputSchema: z.object({
        url: z.string().describe("Full URL including https://"),
        label: z
          .string()
          .describe(
            "Short label shown on the Berry, e.g. 'Strawberry product page'",
          ),
      }) as any,
      execute: async ({ url, label }: { url: string; label: string }) => {
        const tab = self.window.createTab(url);
        const berryId = `berry-tab-${tab.id}`;
        const pos = self.nextPos();
        self.emitToolCall(`Opening ${label}`, berryId);

        self.emit({
          type: "berry-created",
          berry: {
            id: berryId,
            kind: "tab",
            title: label,
            subtitle: safeHostname(url),
            url,
            x: pos.x,
            y: pos.y,
            width: 260,
            height: 170,
            status: "reading",
            workRunId: self.workRunId,
            onMap: true,
            browserTabId: tab.id,
          },
        });
        self.emit({
          type: "agent-state",
          agentId: self.agentId,
          state: "acting",
          currentLabel: `Reading ${label}`,
        });
        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(),
            workRunId: self.workRunId,
            agentId: self.agentId,
            berryId,
            kind: "action",
            label: `Reading ${label}`,
            icon: "read",
          },
        });

        await new Promise<void>((done) => {
          tab.webContents.once("did-finish-load", () => done());
          setTimeout(done, 8_000);
        });

        self.emit({ type: "berry-status", berryId, status: "extracting" });

        let text = "";
        try {
          text = (await tab.getTabText()).slice(0, 6_000);
        } catch {
          text = "(Could not extract page text)";
        }

        try {
          const img = await tab.screenshot();
          if (!img.isEmpty()) {
            self.emit({
              type: "berry-screenshot",
              berryId,
              screenshotDataUrl: img.toDataURL(),
            });
          }
        } catch {
          /* non-fatal */
        }

        self.emit({ type: "berry-status", berryId, status: "complete" });
        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(),
            workRunId: self.workRunId,
            agentId: self.agentId,
            berryId,
            kind: "observation",
            label: `Read ${label}`,
            icon: "eye",
          },
        });
        self.lastSourceBerryId = berryId;

        return { tabId: tab.id, berryId, url, title: tab.title || label, text };
      },
    });

    const search_web = tool({
      description:
        "Search DuckDuckGo for pages matching a query. Returns up to 8 results with {url, title, snippet}. Use navigate_tab on results you want to read.",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
      }) as any,
      execute: async ({ query }: { query: string }) => {
        const short = query.slice(0, 50);
        self.emit({
          type: "agent-state",
          agentId: self.agentId,
          state: "acting",
          currentLabel: `Searching: ${short}`,
        });
        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(),
            workRunId: self.workRunId,
            agentId: self.agentId,
            kind: "action",
            label: `Searching: ${short}`,
            icon: "search",
          },
        });

        try {
          const resp = await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
            { signal: AbortSignal.timeout(10_000) },
          );
          const data = (await resp.json()) as {
            Results?: Array<{ FirstURL?: string; Text?: string }>;
            RelatedTopics?: Array<{
              FirstURL?: string;
              Text?: string;
              Name?: string;
            }>;
          };

          const results = [
            ...(data.Results ?? []),
            ...(data.RelatedTopics ?? []).filter((t) => t.FirstURL && !t.Name),
          ]
            .filter((r): r is { FirstURL: string; Text: string } =>
              Boolean(r.FirstURL && r.Text),
            )
            .slice(0, 8)
            .map((r) => ({
              url: r.FirstURL,
              title:
                r.Text.split(" - ")[0]?.slice(0, 80) ?? r.Text.slice(0, 80),
              snippet: r.Text,
            }));

          self.emit({
            type: "telemetry",
            event: {
              id: self.tid(),
              workRunId: self.workRunId,
              agentId: self.agentId,
              kind: "observation",
              label: `Found ${results.length} results`,
              icon: "eye",
            },
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
      inputSchema: z.object({
        filename: z
          .string()
          .describe("Filename with extension, e.g. 'leads.md'"),
        content: z.string().describe("Full file content"),
        kind: z
          .enum(["report", "lead", "xlsx"])
          .describe("Berry kind: report for Markdown, lead for lead lists"),
        title: z.string().describe("Display title shown on the Berry"),
        subtitle: z
          .string()
          .describe("One-line description shown under the title"),
      }) as any,
      execute: async ({
        filename,
        content,
        kind,
        title,
        subtitle,
      }: {
        filename: string;
        content: string;
        kind: "report" | "lead" | "xlsx";
        title: string;
        subtitle: string;
      }) => {
        const filePath = join(self.artifactsDir, filename);
        await writeFile(filePath, content, "utf-8");

        const berryId = `berry-artifact-${filename.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
        const pos = self.nextPos();
        self.emitToolCall(`Writing ${title}`, berryId);

        self.emit({
          type: "berry-created",
          berry: {
            id: berryId,
            kind,
            title,
            subtitle,
            x: pos.x,
            y: pos.y,
            width: 280,
            height: 150,
            status: "writing",
            workRunId: self.workRunId,
            onMap: true,
            filePath,
          },
        });
        self.emit({
          type: "agent-state",
          agentId: self.agentId,
          state: "acting",
          currentLabel: `Writing ${title}`,
        });
        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(),
            workRunId: self.workRunId,
            agentId: self.agentId,
            berryId,
            fromBerryId: self.lastSourceBerryId,
            toBerryId: berryId,
            kind: "write",
            label: `Writing ${title}`,
            icon: "write",
          },
        });

        await new Promise((r) => setTimeout(r, 400));

        self.emit({ type: "berry-status", berryId, status: "complete" });
        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(),
            workRunId: self.workRunId,
            agentId: self.agentId,
            berryId,
            kind: "complete",
            label: `Wrote ${title}`,
            icon: "check",
          },
        });

        return { berryId, filePath, filename };
      },
    });

    const annotate = tool({
      description:
        "Record your intent, a key decision, an observation, or completion as a telemetry event visible in the Garden. No side effects — pure signal.",
      inputSchema: z.object({
        kind: z
          .enum(["intent", "decision", "observation", "complete"])
          .describe("Telemetry kind"),
        label: z
          .string()
          .max(80)
          .describe("What you are doing or decided, ≤ 60 chars, present-tense"),
        berryId: z
          .string()
          .optional()
          .describe("Berry this annotation relates to, if any"),
      }) as any,
      execute: async ({
        kind,
        label,
        berryId,
      }: {
        kind: "intent" | "decision" | "observation" | "complete";
        label: string;
        berryId?: string;
      }) => {
        const agentState =
          kind === "complete"
            ? "complete"
            : kind === "intent"
              ? "planning"
              : "acting";

        self.emit({
          type: "agent-state",
          agentId: self.agentId,
          state: agentState,
          currentLabel: label,
        });
        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(),
            workRunId: self.workRunId,
            agentId: self.agentId,
            berryId,
            kind,
            label,
            icon:
              kind === "intent"
                ? "compass"
                : kind === "decision"
                  ? "branch"
                  : kind === "complete"
                    ? "check"
                    : "eye",
          },
        });

        return { recorded: true };
      },
    });

    const browser_action = tool({
      description:
        "Operate the live tab the user is watching: click, type, scroll, select, or press a key. " +
        "Target elements in natural language (e.g. 'the Sign in button'); the action is narrated " +
        "on the page with an animated cursor. High-consequence actions (submit, purchase, send, " +
        "login, upload) hard-stop for user approval and BLOCK until the user decides. Use after " +
        "navigate_tab has opened a page.",
      inputSchema: z.object({
        action: z
          .enum(["click", "type", "scroll", "select", "press"])
          .describe("The browser action verb"),
        target: z
          .string()
          .describe(
            "Natural-language description of the element, e.g. 'the email field'",
          ),
        value: z
          .string()
          .optional()
          .describe(
            "Text to type (type), option to choose (select), or key to press (press)",
          ),
        tabId: z
          .string()
          .optional()
          .describe("Tab to act on; defaults to the active tab"),
        label: z
          .string()
          .optional()
          .describe(
            "Plain-language caption, e.g. 'Clicking the Sign in button'",
          ),
      }) as any,
      execute: async ({
        action,
        target,
        value,
        tabId,
        label,
      }: {
        action: ActionKind;
        target: string;
        value?: string;
        tabId?: string;
        label?: string;
      }) => {
        const tab = tabId ? self.window.getTab(tabId) : self.window.activeTab;
        if (!tab) {
          return {
            ok: false,
            error: "No tab to act on — open one with navigate_tab first.",
          };
        }
        const berryId = `berry-tab-${tab.id}`;
        const caption = label ?? `${capitalize(action)} ${target}`;
        self.emitToolCall(caption, berryId);

        const digest = await extractDigest(tab);
        const hit = resolve(target, digest);
        if ("miss" in hit) {
          self.emit({
            type: "telemetry",
            event: {
              id: self.tid(),
              workRunId: self.workRunId,
              agentId: self.agentId,
              berryId,
              kind: "observation",
              label: `Couldn't find: ${target.slice(0, 40)}`,
              icon: "eye",
            },
          });
          return {
            ok: false,
            miss: true,
            error: `No element matched "${target}".`,
            available: digest
              .slice(0, 20)
              .map((d) => ({ text: d.text, role: d.role })),
          };
        }

        const el = digest.find((d) => d.id === hit.id)!;

        // ── Risk gate: BLOCK until the user approves or denies ──────────────
        if (
          requiresApproval({
            kind: action,
            targetText: el.text,
            targetRole: el.role,
          })
        ) {
          self.emit({
            type: "agent-state",
            agentId: self.agentId,
            state: "blocked",
            currentLabel: `Approval needed: ${caption}`.slice(0, 70),
          });
          self.emit({
            type: "telemetry",
            event: {
              id: self.tid(),
              workRunId: self.workRunId,
              agentId: self.agentId,
              berryId,
              kind: "decision",
              label: `Awaiting approval: ${caption}`.slice(0, 60),
              icon: "branch",
            },
          });

          const approved = await self.requestApproval(
            caption,
            `"${el.text}" is a gated action (submit/purchase/send/login/upload).`,
          );

          if (!approved) {
            self.emit({
              type: "telemetry",
              event: {
                id: self.tid(),
                workRunId: self.workRunId,
                agentId: self.agentId,
                berryId,
                kind: "decision",
                label: `Denied: ${caption}`.slice(0, 60),
                icon: "branch",
              },
            });
            return {
              ok: false,
              denied: true,
              reason:
                "The user denied this gated action. Do not retry it — choose a different approach or stop and explain.",
            };
          }
          // Approved → fall through and perform the action.
        }

        let viewportHeight = 800;
        try {
          viewportHeight =
            Number(await tab.runJs("return window.innerHeight")) || 800;
        } catch {
          /* default */
        }

        self.emit({
          type: "agent-state",
          agentId: self.agentId,
          state: "acting",
          currentLabel: caption.slice(0, 70),
        });
        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(),
            workRunId: self.workRunId,
            agentId: self.agentId,
            berryId,
            kind: "action",
            label: caption.slice(0, 60),
            icon: "cursor",
          },
        });

        const cmds = narrate(
          { kind: action, label: caption, viewportHeight },
          el.rect,
          value,
        );
        await playOverlay(tab, cmds);

        const result = await executeAction(tab, action, hit.id, value);

        self.recorder.record({
          kind: action,
          targetText: el.text,
          targetRole: el.role,
          value,
        });
        self.browserActionCount++;

        try {
          const img = await tab.screenshot();
          if (!img.isEmpty()) {
            self.emit({
              type: "berry-screenshot",
              berryId,
              screenshotDataUrl: img.toDataURL(),
            });
          }
        } catch {
          /* non-fatal */
        }

        self.emit({
          type: "telemetry",
          event: {
            id: self.tid(),
            workRunId: self.workRunId,
            agentId: self.agentId,
            berryId,
            kind: result.ok ? "observation" : "decision",
            label: result.ok
              ? `Done: ${caption}`.slice(0, 60)
              : `Failed: ${result.error ?? "action"}`.slice(0, 60),
            icon: result.ok ? "check" : "branch",
          },
        });

        return {
          ok: result.ok,
          error: result.error,
          target: el.text,
          confidence: hit.confidence,
        };
      },
    });

    return {
      navigate_tab,
      search_web,
      write_artifact,
      annotate,
      browser_action,
    };
  }

  // ── Optional bonus: export the browser run as a replayable Playwright script ──

  private exportPlaywrightIfRecorded(): void {
    if (this.browserActionCount === 0) return;
    try {
      const scriptPath = join(this.artifactsDir, "recorded-run.spec.ts");
      void writeFile(scriptPath, this.recorder.toPlaywright(), "utf-8");
      const berryId = "berry-artifact-recorded-run-spec-ts";
      this.emit({
        type: "berry-created",
        berry: {
          id: berryId,
          kind: "report",
          title: "recorded-run.spec.ts",
          subtitle: `${this.browserActionCount} browser actions · Playwright`,
          x: 80,
          y: 580,
          width: 280,
          height: 150,
          status: "complete",
          workRunId: this.workRunId,
          onMap: true,
          filePath: scriptPath,
        },
      });
    } catch {
      /* non-fatal: codegen is a bonus */
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

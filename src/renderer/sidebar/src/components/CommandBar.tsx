import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat } from "../contexts/ChatContext";

const COLLAPSED_HEIGHT = 56;
const EXPANDED_HEIGHT = 400;

const setHeight = (h: number): void => {
  window.sidebarAPI?.setCommandBarHeight(h).catch(() => {});
};

/** Slim horizontal input strip for the tab-view bottom Command Bar. */
const CommandInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}> = ({ value, onChange, onSubmit, disabled }) => {
  const handleKey = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="relative flex w-full items-center"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder="Command Blueberry…"
        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 pl-4 pr-11 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-[#5b8cff]/50 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="absolute right-2 flex size-7 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/[0.08] hover:text-[#5b8cff] disabled:pointer-events-none disabled:opacity-30"
        aria-label="Send"
      >
        <ArrowUp className="size-4" />
      </button>
    </form>
  );
};

const ChatHistory: React.FC<{
  messages: { id: string; role: string; content: string }[];
  isLoading: boolean;
}> = ({ messages, isLoading }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
      {messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-white/25">
            No messages yet — type a command below.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="ml-auto max-w-[80%]">
                <p className="mb-1 text-right font-mono text-[10px] uppercase tracking-wide text-white/30">
                  You
                </p>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm text-white/85">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="mr-auto max-w-[90%]">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-[#5b8cff]/60">
                  Blueberry
                </p>
                <div className="text-sm leading-relaxed text-[#a8c0ff]/85 prose-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ),
          )}
          {isLoading && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5b8cff]/60" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5b8cff]/40 [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5b8cff]/20 [animation-delay:0.4s]" />
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
};

interface PendingApproval {
  id: string;
  caption: string;
  reason: string;
}

/**
 * Approval gate banner (ADR-0003) for the tab-view Command Bar. The agent is
 * blocked on a high-consequence Browser action on the live tab the user is
 * watching; Approve/Deny resolves the gate in main.
 */
const ApprovalBanner: React.FC<{
  approval: PendingApproval;
  onApprove: () => void;
  onDeny: () => void;
}> = ({ approval, onApprove, onDeny }) => (
  <div className="shrink-0 border-b border-amber-400/30 bg-amber-500/[0.08] px-4 py-2.5">
    <p className="font-mono text-[10px] uppercase tracking-wide text-amber-300/90">
      Approval needed
    </p>
    <p className="mt-0.5 truncate text-sm text-white/90">{approval.caption}</p>
    <p className="truncate text-xs text-white/40">{approval.reason}</p>
    <div className="mt-2 flex justify-end gap-2">
      <button
        type="button"
        onClick={onDeny}
        className="rounded-lg border border-white/15 px-3 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
      >
        Deny
      </button>
      <button
        type="button"
        onClick={onApprove}
        className="rounded-lg bg-[#5b8cff] px-3 py-1 text-xs font-medium text-white hover:bg-[#4f7ef0]"
      >
        Approve
      </button>
    </div>
  </div>
);

export const CommandBar: React.FC = () => {
  const { messages, isLoading, sendMessage } = useChat();
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);

  // Mirror main's Approval gate so the user can decide while watching the tab.
  useEffect(() => {
    const unsub = window.sidebarAPI?.onGardenState?.((snapshot) => {
      const snap = snapshot as { pendingApproval: PendingApproval | null };
      setPendingApproval(snap?.pendingApproval ?? null);
    });
    return () => unsub?.();
  }, []);

  const resolveApproval = (approved: boolean): void => {
    if (!pendingApproval) return;
    void window.sidebarAPI?.resolveApproval?.(pendingApproval.id, approved);
  };

  const latestReply =
    [...messages].reverse().find((m) => m.role === "assistant")?.content ??
    null;

  const toggleExpand = (): void => {
    const next = !expanded;
    setExpanded(next);
    setHeight(next ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
  };

  const handleSubmit = (): void => {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text);
    setInput("");
  };

  return (
    <div
      className="app-region-no-drag flex h-full flex-col overflow-hidden border-t border-white/[0.08]"
      style={{ background: "#0e1119" }}
    >
      {/* Blocking Approval gate for the live tab the agent is driving */}
      {pendingApproval && (
        <ApprovalBanner
          approval={pendingApproval}
          onApprove={() => resolveApproval(true)}
          onDeny={() => resolveApproval(false)}
        />
      )}

      {/* Expanded chat history */}
      {expanded && <ChatHistory messages={messages} isLoading={isLoading} />}

      {/* Collapsed preview — latest agent reply */}
      {!expanded && latestReply && (
        <div className="shrink-0 px-4 pt-1.5">
          <p className="truncate text-xs text-[#a8c0ff]/50">{latestReply}</p>
        </div>
      )}

      {/* Always-visible bar: input + expand toggle */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={toggleExpand}
          className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-white/30 transition-colors hover:bg-white/[0.07] hover:text-white/60"
          aria-label={expanded ? "Collapse chat" : "Expand chat"}
        >
          {expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </button>
        <CommandInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

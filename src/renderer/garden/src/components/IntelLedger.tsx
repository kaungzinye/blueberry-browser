import React from "react";
import {
  FileDown,
  FileSpreadsheet,
  FileText,
  Globe2,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { LedgerEntry } from "../domain/gardenDomain";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";

const kindIcon = {
  tab: Globe2,
  sheet: FileSpreadsheet,
  xlsx: FileDown,
  lead: Sparkles,
  report: FileText,
};

interface IntelLedgerStripProps {
  entries: LedgerEntry[];
  expanded: boolean;
  onToggle: () => void;
}

export const IntelLedgerStrip: React.FC<IntelLedgerStripProps> = ({
  entries,
  expanded,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="mb-3 flex w-full items-center justify-between rounded-2xl border border-line/10 bg-white/[0.03] px-4 py-2 text-left text-sm text-ink transition-colors hover:bg-white/[0.06]"
  >
    <span>
      Ledger · {entries.length} artifact{entries.length === 1 ? "" : "s"}
    </span>
    <span className="font-mono text-xs text-accent">
      {expanded ? "Hide" : "⌘I"}
    </span>
  </button>
);

interface IntelLedgerOverlayProps {
  entries: LedgerEntry[];
  onClose: () => void;
  onShowOnGarden: (berryId: string) => void;
}

export const IntelLedgerOverlay: React.FC<IntelLedgerOverlayProps> = ({
  entries,
  onClose,
  onShowOnGarden,
}) => {
  const grouped = entries.reduce<Record<string, LedgerEntry[]>>(
    (groups, entry) => {
      const key = entry.workRunTitle;
      groups[key] = groups[key] ?? [];
      groups[key].push(entry);
      return groups;
    },
    {},
  );

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-surface-0/70 p-6 backdrop-blur-sm">
      <section className="flex max-h-[78vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line/10 bg-surface-1/95 shadow-panel">
        <header className="flex items-center justify-between border-b border-line/10 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent/70">
              Intel Ledger
            </p>
            <h2 className="font-display text-xl font-semibold text-ink">
              Garden Artifacts
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-5 py-4">
            {Object.entries(grouped).map(([workRunTitle, workEntries]) => (
              <div key={workRunTitle} className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-accent-strong">
                  {workRunTitle}
                </h3>
                <div className="space-y-2">
                  {workEntries.map((entry) => {
                    const Icon = kindIcon[entry.kind];
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 rounded-2xl border border-line/10 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="rounded-xl bg-accent/12 p-2 text-accent">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-ink">
                            {entry.title}
                          </div>
                          <div className="text-xs text-ink-muted">
                            {entry.subtitle}
                            {entry.filePath ? ` · ${entry.filePath}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!entry.onMap && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onShowOnGarden(entry.id)}
                            >
                              <MapPin className="size-3" />
                              Show on Garden
                            </Button>
                          )}
                          <Badge variant={entry.onMap ? "accent" : "neutral"}>
                            {entry.onMap ? "On map" : "Ledger"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>
    </div>
  );
};

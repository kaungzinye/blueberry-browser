import React from "react";
import {
  Archive,
  FileDown,
  FileSpreadsheet,
  FileText,
  Globe2,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { LedgerEntry } from "../domain/gardenDomain";

const kindIcon = {
  tab: Globe2,
  sheet: FileSpreadsheet,
  xlsx: FileDown,
  lead: Sparkles,
  report: FileText,
  "work-run": Archive,
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
    className="mb-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
  >
    <span>
      Ledger · {entries.length} artifact{entries.length === 1 ? "" : "s"}
    </span>
    <span className="text-xs text-blue-200">
      {expanded ? "Hide" : "Cmd+I"}
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
  const grouped = entries.reduce<Record<string, LedgerEntry[]>>((groups, entry) => {
    const key = entry.workRunTitle;
    groups[key] = groups[key] ?? [];
    groups[key].push(entry);
    return groups;
  }, {});

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
      <section className="max-h-[78vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-blue-200/70">
              Intel Ledger
            </p>
            <h2 className="text-xl font-semibold text-white">
              Blueberry Sales Leads
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4">
          {Object.entries(grouped).map(([workRunTitle, workEntries]) => (
            <div key={workRunTitle} className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-blue-100">
                {workRunTitle}
              </h3>
              <div className="space-y-2">
                {workEntries.map((entry) => {
                  const Icon = kindIcon[entry.kind];
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="rounded-xl bg-blue-200/10 p-2 text-blue-100">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white">{entry.title}</div>
                        <div className="text-xs text-slate-400">
                          {entry.subtitle}
                          {entry.filePath ? ` · ${entry.filePath}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!entry.onMap && (
                          <button
                            type="button"
                            onClick={() => onShowOnGarden(entry.id)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                          >
                            <MapPin className="mr-1 inline size-3" />
                            Show on Garden
                          </button>
                        )}
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300">
                          {entry.onMap ? "On map" : "Ledger"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

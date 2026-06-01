import React from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { Berry } from "../domain/gardenDomain";

interface ReaderPaneProps {
  berry: Berry;
  content: string;
  onBack: () => void;
}

export const ReaderPane: React.FC<ReaderPaneProps> = ({
  berry,
  content,
  onBack,
}) => (
  <section className="absolute inset-0 z-40 flex flex-col bg-[#020817]/95 backdrop-blur-xl">
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15"
      >
        <ArrowLeft className="size-4" />
        Back to Garden
      </button>
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <FileText className="size-4 text-blue-200" />
        <span>{berry.title}</span>
      </div>
    </header>

    <article className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
      <ReaderMarkdown content={content} />
    </article>
  </section>
);

const ReaderMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const blocks = content.trim().split(/\n\n+/);

  return (
    <div className="space-y-4 text-slate-100">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={index} className="text-3xl font-semibold">
              {trimmed.slice(2)}
            </h1>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={index} className="pt-2 text-xl font-semibold text-blue-100">
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith("- ")) {
          const items = trimmed.split("\n").map((line) => line.replace(/^- /, ""));
          return (
            <ul key={index} className="list-disc space-y-2 pl-6 text-slate-300">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="leading-7 text-slate-300">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
};

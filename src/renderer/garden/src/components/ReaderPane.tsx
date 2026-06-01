import React from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { Berry } from "../domain/gardenDomain";
import { Button } from "./ui/button";

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
  <section className="absolute inset-0 z-40 flex flex-col bg-surface-0/96 backdrop-blur-xl">
    <header className="flex items-center justify-between border-b border-line/10 px-6 py-4">
      <Button variant="outline" size="md" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back to Garden
      </Button>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <FileText className="size-4 text-accent" />
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
    <div className="space-y-4 text-ink">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={index} className="font-display text-3xl font-semibold">
              {trimmed.slice(2)}
            </h1>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={index}
              className="pt-2 font-display text-xl font-semibold text-accent-strong"
            >
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith("- ")) {
          const items = trimmed.split("\n").map((line) => line.replace(/^- /, ""));
          return (
            <ul key={index} className="list-disc space-y-2 pl-6 text-ink-muted">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="leading-7 text-ink-muted">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
};

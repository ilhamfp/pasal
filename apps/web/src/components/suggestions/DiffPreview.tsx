"use client";

import { computeDiff, diffStats } from "./diff-utils";

interface DiffPreviewProps {
  original: string;
  modified: string;
}

export default function DiffPreview({ original, modified }: DiffPreviewProps) {
  const ops = computeDiff(original, modified);
  const stats = diffStats(ops);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b bg-secondary/30">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pratinjau Perubahan
        </span>
        <span className="text-xs text-muted-foreground">
          {stats.changes} perubahan &middot; {stats.charsDeleted} dihapus &middot; {stats.charsInserted} ditambahkan
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {ops.map((op, i) => {
          if (op.type === "equal") {
            return <span key={i}>{op.text}</span>;
          }
          if (op.type === "delete") {
            return (
              <span
                key={i}
                className="bg-destructive/10 text-destructive line-through"
              >
                {op.text}
              </span>
            );
          }
          // insert
          return (
            <span
              key={i}
              className="bg-status-berlaku-bg text-status-berlaku underline"
            >
              {op.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

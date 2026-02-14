"use client";

import { forwardRef } from "react";

interface TextPanelProps {
  content: string;
  editable: boolean;
  onChange?: (value: string) => void;
  onScroll?: () => void;
  label: string;
}

const TextPanel = forwardRef<HTMLDivElement | HTMLTextAreaElement, TextPanelProps>(
  function TextPanel({ content, editable, onChange, onScroll, label }, ref) {
    const sharedClasses =
      "w-full h-full font-mono text-sm leading-relaxed whitespace-pre-wrap p-4 outline-none resize-none overflow-y-auto";

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-none px-4 py-2 border-b bg-secondary/30">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        {editable ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            value={content}
            onChange={(e) => onChange?.(e.target.value)}
            onScroll={onScroll}
            className={`${sharedClasses} bg-card flex-1 min-h-0`}
          />
        ) : (
          <div
            ref={ref as React.Ref<HTMLDivElement>}
            onScroll={onScroll}
            className={`${sharedClasses} bg-secondary/20 flex-1 min-h-0`}
          >
            {content}
          </div>
        )}
      </div>
    );
  },
);

export default TextPanel;

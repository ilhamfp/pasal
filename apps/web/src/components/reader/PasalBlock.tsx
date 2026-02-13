"use client";

import { useState } from "react";
import PasalLogo from "@/components/PasalLogo";
import CopyButton from "@/components/CopyButton";
import SuggestionForm from "./SuggestionForm";
import { Pencil } from "lucide-react";

interface PasalNode {
  id: number;
  number: string;
  content_text: string | null;
  heading: string | null;
}

interface PasalBlockProps {
  pasal: PasalNode;
  frbrUri: string;
  lawTitle: string;
  workId: number;
}

export default function PasalBlock({ pasal, frbrUri, lawTitle, workId }: PasalBlockProps) {
  const [showForm, setShowForm] = useState(false);
  const content = pasal.content_text || "";
  const jsonData = JSON.stringify({ pasal: pasal.number, content }, null, 2);

  return (
    <article id={`pasal-${pasal.number}`} className="mb-8 scroll-mt-20">
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-1.5 font-heading text-base">
          <PasalLogo size={18} className="text-primary/60" />
          Pasal {pasal.number}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            title="Sarankan Koreksi"
          >
            <Pencil className="h-3 w-3" />
            Koreksi
          </button>
          <CopyButton text={jsonData} label="JSON" />
        </div>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>

      {showForm && (
        <SuggestionForm
          workId={workId}
          nodeId={pasal.id}
          nodeType="pasal"
          nodeNumber={pasal.number}
          currentContent={content}
          onClose={() => setShowForm(false)}
        />
      )}
    </article>
  );
}

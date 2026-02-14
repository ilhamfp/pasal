"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PasalLogo from "@/components/PasalLogo";
import CopyButton from "@/components/CopyButton";
import { Pencil } from "lucide-react";

interface PasalNode {
  id: number;
  number: string;
  content_text: string | null;
  heading: string | null;
  pdf_page_start: number | null;
  pdf_page_end: number | null;
}

interface PasalBlockProps {
  pasal: PasalNode;
}

export default function PasalBlock({ pasal }: PasalBlockProps) {
  const pathname = usePathname();
  const content = pasal.content_text || "";
  const jsonData = JSON.stringify({ pasal: pasal.number, content }, null, 2);
  const koreksiHref = `${pathname}/koreksi/${pasal.id}`;

  return (
    <article
      id={`pasal-${pasal.number}`}
      data-pdf-page={pasal.pdf_page_start ?? undefined}
      className="mb-8 scroll-mt-20"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-1.5 font-heading text-base">
          <PasalLogo size={18} className="text-primary/60" />
          Pasal {pasal.number}
        </h3>
        <div className="flex items-center gap-1">
          <Link
            href={koreksiHref}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            title="Sarankan Koreksi"
          >
            <Pencil className="h-3 w-3" />
            Koreksi
          </Link>
          <CopyButton text={jsonData} label="JSON" />
        </div>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
    </article>
  );
}

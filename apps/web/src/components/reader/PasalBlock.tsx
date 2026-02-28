import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import PasalLogo from "@/components/PasalLogo";
import CopyButton from "@/components/CopyButton";
import { Pencil, Link2 } from "lucide-react";

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
  pathname: string;
  pageUrl: string;
}

export default function PasalBlock({ pasal, pathname, pageUrl }: PasalBlockProps) {
  const t = useTranslations("reader");
  const content = pasal.content_text || "";
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
          {t("pasalPrefix")} {pasal.number}
        </h3>
        <div className="flex items-center gap-1.5 no-print">
          <Link
            href={koreksiHref}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 sm:px-2 sm:py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            aria-label={t("suggestCorrection")}
          >
            <Pencil className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden="true" />
            <span className="hidden sm:inline">{t("correction")}</span>
          </Link>
          <CopyButton text={`${pageUrl}#pasal-${pasal.number}`} label="Link" icon={<Link2 className="h-3 w-3" aria-hidden="true" />} />
          <CopyButton text={content} />
        </div>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</div>
    </article>
  );
}

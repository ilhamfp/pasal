import { useLocale, useTranslations } from "next-intl";

export default function LegalContentLanguageNotice() {
  const locale = useLocale();
  const t = useTranslations("disclaimer");

  // Only show on English pages
  if (locale === "id") return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
      <span aria-hidden="true" className="text-sm sm:text-base shrink-0">🔤</span>
      <p>{t("legalContentNotice")}</p>
    </div>
  );
}

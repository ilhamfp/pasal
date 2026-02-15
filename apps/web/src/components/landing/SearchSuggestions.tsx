"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function SearchSuggestions() {
  const t = useTranslations("hero");
  const st = useTranslations("search");

  // Search terms stay in Indonesian — they are queries for Indonesian legal content
  const suggestions = [
    st("suggestion1"),
    st("suggestion2"),
    st("suggestion3"),
    st("suggestion4"),
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-sm text-muted-foreground">{t("trySuggestion")}</span>
      {suggestions.map((q) => (
        <Link
          key={q}
          href={`/search?q=${encodeURIComponent(q)}`}
          className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {q}
        </Link>
      ))}
    </div>
  );
}

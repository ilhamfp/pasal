"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { X } from "lucide-react";

interface SearchFiltersProps {
  regulationTypes: { code: string; name_id: string }[];
  currentType?: string;
  currentYear?: string;
  currentStatus?: string;
  currentQuery?: string;
}

export default function SearchFilters({
  regulationTypes,
  currentType,
  currentYear,
  currentStatus,
  currentQuery,
}: SearchFiltersProps) {
  const t = useTranslations("filters");
  const router = useRouter();
  const [yearInput, setYearInput] = useState(currentYear || "");
  const [prevYear, setPrevYear] = useState(currentYear);
  if (currentYear !== prevYear) {
    setPrevYear(currentYear);
    setYearInput(currentYear || "");
  }

  const hasFilters = currentType || currentYear || currentStatus;

  function pushParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (currentQuery) params.set("q", currentQuery);

    const merged = {
      type: currentType,
      year: currentYear,
      status: currentStatus,
      ...updates,
    };

    for (const [key, val] of Object.entries(merged)) {
      if (val) params.set(key, val);
    }

    // Reset to page 1 on filter change
    params.delete("page");

    router.push(`/search?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams();
    if (currentQuery) params.set("q", currentQuery);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
      {/* Type dropdown */}
      <select
        value={currentType || ""}
        onChange={(e) => pushParams({ type: e.target.value || undefined })}
        aria-label={t("typeLabel")}
        name="type"
        className="rounded-lg border bg-card px-3 py-2.5 sm:py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:outline-none hover:border-border/80 motion-safe:transition-colors sm:flex-1"
      >
        <option value="">{t("allTypes")}</option>
        {regulationTypes.map((rt) => (
          <option key={rt.code} value={rt.code}>
            {rt.code} — {rt.name_id}
          </option>
        ))}
      </select>

      {/* Year input */}
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder={t("yearPlaceholder")}
        value={yearInput}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "");
          setYearInput(val);
          if (val.length === 4 || val === "") {
            pushParams({ year: val || undefined });
          }
        }}
        onBlur={() => {
          if (yearInput.length === 4) {
            pushParams({ year: yearInput });
          } else {
            setYearInput(currentYear || "");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && yearInput.length === 4) {
            pushParams({ year: yearInput });
          }
        }}
        aria-label={t("yearLabel")}
        name="year"
        autoComplete="off"
        className="w-full sm:w-24 rounded-lg border bg-card px-3 py-2.5 sm:py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:outline-none hover:border-border/80 motion-safe:transition-colors"
      />

      {/* Status dropdown */}
      <select
        value={currentStatus || ""}
        onChange={(e) => pushParams({ status: e.target.value || undefined })}
        aria-label={t("statusLabel")}
        name="status"
        className="rounded-lg border bg-card px-3 py-2.5 sm:py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:outline-none hover:border-border/80 motion-safe:transition-colors sm:flex-1"
      >
        <option value="">{t("allStatus")}</option>
        <option value="berlaku">{t("statusActive")}</option>
        <option value="diubah">{t("statusAmended")}</option>
        <option value="dicabut">{t("statusRevoked")}</option>
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2.5 sm:py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 motion-safe:transition-colors"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t("clearFilters")}
        </button>
      )}
    </div>
  );
}

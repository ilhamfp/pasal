"use client";

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
    <div className="flex flex-wrap items-center gap-3">
      {/* Type dropdown */}
      <select
        value={currentType || ""}
        onChange={(e) => pushParams({ type: e.target.value || undefined })}
        aria-label={t("typeLabel")}
        className="rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
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
        type="number"
        min={1945}
        max={2026}
        placeholder={t("yearPlaceholder")}
        value={currentYear || ""}
        onChange={(e) => {
          const val = e.target.value;
          if (val.length === 4 || val === "") {
            pushParams({ year: val || undefined });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const val = (e.target as HTMLInputElement).value;
            if (val.length === 4 || val === "") {
              pushParams({ year: val || undefined });
            }
          }
        }}
        aria-label={t("yearLabel")}
        className="w-24 rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      {/* Status dropdown */}
      <select
        value={currentStatus || ""}
        onChange={(e) => pushParams({ status: e.target.value || undefined })}
        aria-label={t("statusLabel")}
        className="rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
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
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          {t("clearFilters")}
        </button>
      )}
    </div>
  );
}
